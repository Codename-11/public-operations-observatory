import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Database } from '../db/client.js';
import type { JsonValue } from '../domain/observation.js';

interface ObservationRow {
  record_kind: string;
  external_id: string;
  observed_bucket: Date;
  payload: JsonValue;
  evidence_url: string;
}

interface RunRow {
  finished_at: Date;
  status: string;
  error_summary: string | null;
}

interface AnnotationRow {
  occurred_at: Date;
  kind: string;
  title: string;
  evidence_url: string;
  note: string | null;
}

interface BriefingOptions {
  freshnessHours: number;
  metricVersion?: number;
  outputDirectory: string;
  scope: string;
  windowEnd: Date;
  windowStart: Date;
}

export interface BriefingResult {
  digest: string;
  markdown: string;
  outputPath: string;
}

export async function generateWeeklyBriefing(
  database: Database,
  options: BriefingOptions,
): Promise<BriefingResult> {
  const metricVersion = options.metricVersion ?? 1;
  if (metricVersion !== 1) {
    throw new Error(`Unsupported metric definition version: ${metricVersion}`);
  }
  const [windowRows, latestRows, priorRows, runRows, annotationRows] = await Promise.all([
    database.query<ObservationRow>(
      `SELECT DISTINCT ON (record_kind, external_id, observed_bucket)
         record_kind, external_id, observed_bucket, payload, evidence_url
       FROM observations
       WHERE source = 'github' AND scope = $1
         AND observed_bucket >= $2 AND observed_bucket < $3
         AND created_at <= $3
       ORDER BY record_kind, external_id, observed_bucket, created_at DESC`,
      [options.scope, options.windowStart, options.windowEnd],
    ),
    database.query<ObservationRow>(
      `SELECT DISTINCT ON (record_kind, external_id)
         record_kind, external_id, observed_bucket, payload, evidence_url
       FROM observations
       WHERE source = 'github' AND scope = $1
         AND observed_bucket < $2 AND created_at <= $2
       ORDER BY record_kind, external_id, observed_bucket DESC, created_at DESC`,
      [options.scope, options.windowEnd],
    ),
    database.query<ObservationRow>(
      `SELECT DISTINCT ON (record_kind, external_id)
         record_kind, external_id, observed_bucket, payload, evidence_url
       FROM observations
       WHERE source = 'github' AND scope = $1
         AND observed_bucket < $2 AND created_at <= $3
       ORDER BY record_kind, external_id, observed_bucket DESC, created_at DESC`,
      [options.scope, options.windowStart, options.windowEnd],
    ),
    database.query<RunRow>(
      `SELECT finished_at, status, error_summary
      FROM collection_runs
      WHERE source = 'github' AND scope = $1
        AND finished_at IS NOT NULL AND finished_at <= $2
      ORDER BY finished_at DESC
      LIMIT 1`,
      [options.scope, options.windowEnd],
    ),
    database.query<AnnotationRow>(
      `SELECT occurred_at, kind, title, evidence_url, note
       FROM annotations
       WHERE scope = $1 AND occurred_at >= $2 AND occurred_at < $3
       ORDER BY occurred_at, kind, title`,
      [options.scope, options.windowStart, options.windowEnd],
    ),
  ]);

  const markdown = renderBriefing(
    options,
    windowRows.rows,
    latestRows.rows,
    priorRows.rows,
    runRows.rows[0],
    annotationRows.rows,
  );
  const digest = createHash('sha256').update(markdown).digest('hex');
  await database.query(
    `INSERT INTO briefing_revisions
       (scope, window_start, window_end, metric_version, content_digest, content_markdown)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [options.scope, options.windowStart, options.windowEnd, metricVersion, digest, markdown],
  );

  const outputPath = resolveBriefingOutputPath(
    options.outputDirectory,
    options.scope,
    options.windowEnd,
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf8');
  return { digest, markdown, outputPath };
}

function renderBriefing(
  options: BriefingOptions,
  windowRows: ObservationRow[],
  latestRows: ObservationRow[],
  priorRows: ObservationRow[],
  latestRun: RunRow | undefined,
  annotations: AnnotationRow[],
): string {
  const latest = indexRows(latestRows);
  const prior = indexRows(priorRows);
  const repository = latest.get('repository.summary:repository');
  const priorRepository = prior.get('repository.summary:repository');
  const issues = latest.get('issues.summary:issues');
  const priorIssues = prior.get('issues.summary:issues');
  const pulls = latest.get('pulls.summary:pulls');
  const workflows = latest.get('workflows.summary:workflow-runs');
  const views = sumPayloadNumber(windowRows, 'traffic.views', 'count');
  const uniqueViews = sumPayloadNumber(windowRows, 'traffic.views', 'uniques');
  const clones = sumPayloadNumber(windowRows, 'traffic.clones', 'count');
  const releaseRows = latestRows.filter((row) => row.record_kind === 'release.summary');
  const releases = releaseRows.filter((row) => {
    const publishedAt = payloadString(row.payload, 'publishedAt');
    if (!publishedAt) return false;
    const date = new Date(publishedAt);
    return date >= options.windowStart && date < options.windowEnd;
  });
  const warnings = buildWarnings(options, latestRun, windowRows);

  const lines = [
    `# ${options.scope} public-operations briefing`,
    '',
    `**Window:** ${formatDate(options.windowStart)} through ${formatDate(options.windowEnd)} (UTC, end exclusive)  `,
    `**Metric definition:** v${options.metricVersion ?? 1}  `,
    `**Generated from:** persisted Observatory observations`,
    '',
    '## Signal summary',
    '',
    '| Signal | Current/window value | Change | Evidence |',
    '| --- | ---: | ---: | --- |',
    metricLine(
      'GitHub stars',
      payloadNumber(repository?.payload, 'stars'),
      delta(repository, priorRepository, 'stars'),
      repository?.evidence_url,
    ),
    metricLine(
      'GitHub forks',
      payloadNumber(repository?.payload, 'forks'),
      delta(repository, priorRepository, 'forks'),
      repository?.evidence_url,
    ),
    metricLine('Page views', views, undefined, firstEvidence(windowRows, 'traffic.views')),
    metricLine(
      'Unique page views',
      uniqueViews,
      undefined,
      firstEvidence(windowRows, 'traffic.views'),
    ),
    metricLine('Repository clones', clones, undefined, firstEvidence(windowRows, 'traffic.clones')),
    metricLine(
      'Open issues',
      payloadNumber(issues?.payload, 'open'),
      delta(issues, priorIssues, 'open'),
      issues?.evidence_url,
    ),
    metricLine(
      'Open pull requests',
      payloadNumber(pulls?.payload, 'open'),
      undefined,
      pulls?.evidence_url,
    ),
    metricLine(
      'Workflow runs (all time)',
      payloadNumber(workflows?.payload, 'totalRuns'),
      undefined,
      workflows?.evidence_url,
    ),
    '',
    '## Operational timeline',
    '',
    ...(annotations.length === 0
      ? [
          'No release, documentation, or public-communication annotations were recorded in this window.',
        ]
      : annotations.map((annotation) => {
          const note = annotation.note ? ` — ${escapeMarkdown(annotation.note)}` : '';
          return `- ${formatDate(annotation.occurred_at)} · ${annotation.kind} · [${escapeMarkdown(annotation.title)}](${markdownDestination(annotation.evidence_url)})${note}`;
        })),
    '',
    '## Releases in this window',
    '',
    ...(releases.length === 0
      ? ['No persisted release was published in this window.']
      : releases
          .sort((left, right) => left.external_id.localeCompare(right.external_id))
          .map((release) => {
            const tag = payloadString(release.payload, 'tag') ?? release.external_id;
            const downloads = payloadNumber(release.payload, 'totalAssetDownloads');
            return `- [${escapeMarkdown(tag)}](${markdownDestination(release.evidence_url)}) — ${formatNumber(downloads)} cumulative asset downloads at collection time.`;
          })),
    '',
    '## Freshness and caveats',
    '',
    ...warnings.map((warning) => `- ${warning}`),
    '- Annotations establish chronology only. This briefing does not claim that a release or communication caused a metric change.',
    '- GitHub traffic endpoints expose a rolling history. Missing collection days are reported rather than interpolated.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildWarnings(
  options: BriefingOptions,
  latestRun: RunRow | undefined,
  windowRows: ObservationRow[],
): string[] {
  const warnings: string[] = [];
  if (!latestRun) {
    warnings.push(
      'No completed collection run is available; all signals should be treated as stale.',
    );
  } else {
    const ageHours = (options.windowEnd.getTime() - latestRun.finished_at.getTime()) / 3_600_000;
    warnings.push(
      `Latest collection: ${latestRun.finished_at.toISOString()} (${latestRun.status}).`,
    );
    if (ageHours > options.freshnessHours) {
      warnings.push(
        `Source freshness exceeded the ${options.freshnessHours}-hour expectation (${ageHours.toFixed(1)} hours old).`,
      );
    }
    if (latestRun.error_summary)
      warnings.push(`Partial collection: ${escapeMarkdown(latestRun.error_summary)}.`);
  }
  for (const kind of ['traffic.views', 'traffic.clones']) {
    if (!windowRows.some((row) => row.record_kind === kind)) {
      warnings.push(`${kind} is unavailable for this window.`);
    }
  }
  return warnings;
}

function indexRows(rows: ObservationRow[]): Map<string, ObservationRow> {
  return new Map(rows.map((row) => [`${row.record_kind}:${row.external_id}`, row]));
}

function delta(
  current: ObservationRow | undefined,
  previous: ObservationRow | undefined,
  key: string,
): number | undefined {
  const currentValue = payloadNumber(current?.payload, key);
  const previousValue = payloadNumber(previous?.payload, key);
  return currentValue === undefined || previousValue === undefined
    ? undefined
    : currentValue - previousValue;
}

function payloadNumber(payload: JsonValue | undefined, key: string): number | undefined {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return undefined;
  const value = payload[key];
  return typeof value === 'number' ? value : undefined;
}

function payloadString(payload: JsonValue, key: string): string | undefined {
  if (Array.isArray(payload) || typeof payload !== 'object' || payload === null) return undefined;
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function sumPayloadNumber(rows: ObservationRow[], kind: string, key: string): number | undefined {
  const matching = rows.filter((row) => row.record_kind === kind);
  if (matching.length === 0) return undefined;
  return matching.reduce((total, row) => total + (payloadNumber(row.payload, key) ?? 0), 0);
}

function firstEvidence(rows: ObservationRow[], kind: string): string | undefined {
  return rows.find((row) => row.record_kind === kind)?.evidence_url;
}

function metricLine(
  label: string,
  value: number | undefined,
  change: number | undefined,
  evidenceUrl: string | undefined,
): string {
  const evidence = evidenceUrl ? `[source](${markdownDestination(evidenceUrl)})` : 'unavailable';
  const changeText =
    change === undefined ? '—' : `${change >= 0 ? '+' : ''}${change.toLocaleString('en-US')}`;
  return `| ${label} | ${formatNumber(value)} | ${changeText} | ${evidence} |`;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? 'unavailable' : value.toLocaleString('en-US');
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveBriefingOutputPath(
  outputDirectory: string,
  scope: string,
  windowEnd: Date,
): string {
  const outputRoot = path.resolve(outputDirectory);
  const safeScope = scope.replaceAll(/[^A-Za-z0-9._-]/g, '-');
  const outputPath = path.resolve(outputRoot, `${safeScope}-${formatDate(windowEnd)}.md`);
  const relative = path.relative(outputRoot, outputPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Briefing output path escapes the configured output directory');
  }
  return outputPath;
}

function markdownDestination(value: string): string {
  return `<${value.replaceAll('\\', '%5C').replaceAll('<', '%3C').replaceAll('>', '%3E')}>`;
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('`', '\\`')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', ' ')
    .replaceAll('\r', ' ');
}
