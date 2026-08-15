import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Database } from '../db/client.js';
import type { JsonValue } from '../domain/observation.js';
import {
  evaluateLatestPerEntityMetric,
  evaluateMetrics,
  type EvaluatedMetric,
} from '../metrics/evaluate.js';

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
  source_metadata: JsonValue;
}

interface CheckpointRow {
  cursor_at: Date;
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
  const [metrics, releaseDownloads, releaseRows, runRows, annotationRows, checkpointRows] =
    await Promise.all([
      evaluateMetrics(
        database,
        options.scope,
        metricVersion,
        options.windowStart,
        options.windowEnd,
      ),
      evaluateLatestPerEntityMetric(
        database,
        options.scope,
        metricVersion,
        'github.release_asset_downloads',
        options.windowEnd,
      ),
      database.query<ObservationRow>(
        `SELECT DISTINCT ON (external_id)
         record_kind, external_id, effective_at AS observed_bucket, payload, evidence_url
       FROM normalized_records
       WHERE source = 'github' AND scope = $1 AND record_kind = 'release.summary'
         AND effective_at < $2 AND source_created_at <= $2 AND normalized_at <= $2
       ORDER BY external_id, effective_at DESC, normalized_at DESC`,
        [options.scope, options.windowEnd],
      ),
      database.query<RunRow>(
        `SELECT finished_at, status, error_summary, source_metadata
      FROM collection_runs
      WHERE source = 'github' AND scope = $1
        AND operation = 'snapshot'
        AND finished_at IS NOT NULL AND finished_at <= $2
      ORDER BY finished_at DESC
      LIMIT 1`,
        [options.scope, options.windowEnd],
      ),
      database.query<AnnotationRow>(
        `SELECT occurred_at, kind, title, evidence_url, note
       FROM annotations
       WHERE scope = $1 AND occurred_at >= $2 AND occurred_at < $3
         AND created_at <= $3
       ORDER BY occurred_at, kind, title`,
        [options.scope, options.windowStart, options.windowEnd],
      ),
      database.query<CheckpointRow>(
        `SELECT history.cursor_at
       FROM source_checkpoint_history history
       JOIN collection_runs run ON run.id = history.collection_run_id
       WHERE history.source = 'github' AND history.scope = $1
         AND history.checkpoint_key = 'daily-collection'
         AND history.cursor_at <= $2 AND history.recorded_at <= $2
         AND run.status = 'succeeded' AND run.finished_at <= $2
       ORDER BY history.cursor_at DESC LIMIT 1`,
        [options.scope, options.windowEnd],
      ),
    ]);

  const markdown = renderBriefing(
    options,
    metrics,
    releaseDownloads,
    releaseRows.rows,
    runRows.rows[0],
    annotationRows.rows,
    checkpointRows.rows[0],
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
  metrics: Map<string, EvaluatedMetric>,
  releaseDownloads: Map<string, EvaluatedMetric>,
  releaseRows: ObservationRow[],
  latestRun: RunRow | undefined,
  annotations: AnnotationRow[],
  checkpoint: CheckpointRow | undefined,
): string {
  const releases = releaseRows.filter((row) => {
    const publishedAt = payloadString(row.payload, 'publishedAt');
    if (!publishedAt) return false;
    const date = new Date(publishedAt);
    return date >= options.windowStart && date < options.windowEnd;
  });
  const warnings = buildWarnings(options, latestRun, metrics, checkpoint);

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
    metricLine('GitHub stars', metrics.get('github.stars')),
    metricLine('GitHub forks', metrics.get('github.forks')),
    metricLine('Page views', metrics.get('github.views')),
    metricLine('Unique page views', metrics.get('github.unique_views')),
    metricLine('Repository clones', metrics.get('github.clones')),
    metricLine('Open issues', metrics.get('github.open_issues')),
    metricLine('Open pull requests', metrics.get('github.open_pulls')),
    metricLine('Workflow runs (all time)', metrics.get('github.workflow_runs')),
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
            const downloads = releaseDownloads.get(release.external_id)?.value;
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
  metrics: Map<string, EvaluatedMetric>,
  checkpoint: CheckpointRow | undefined,
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
    warnings.push(...rateLimitWarnings(latestRun.source_metadata));
  }
  if (checkpoint) {
    warnings.push(`Last successful checkpoint: ${checkpoint.cursor_at.toISOString()}.`);
  } else {
    warnings.push('No successful collection checkpoint is available for this window.');
  }
  for (const metricKey of ['github.views', 'github.clones']) {
    if (metrics.get(metricKey)?.value === undefined) {
      warnings.push(`${metricKey} is unavailable for this window.`);
    }
  }
  return warnings;
}

function payloadString(payload: JsonValue, key: string): string | undefined {
  if (Array.isArray(payload) || typeof payload !== 'object' || payload === null) return undefined;
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function metricLine(label: string, metric: EvaluatedMetric | undefined): string {
  const evidence = metric?.evidenceUrl
    ? `[source](${markdownDestination(metric.evidenceUrl)})`
    : 'unavailable';
  const change =
    metric?.value === undefined || metric.previous === undefined
      ? undefined
      : metric.value - metric.previous;
  const changeText =
    change === undefined ? '—' : `${change >= 0 ? '+' : ''}${change.toLocaleString('en-US')}`;
  return `| ${label} | ${formatNumber(metric?.value)} | ${changeText} | ${evidence} |`;
}

function jsonNumber(value: JsonValue, key: string): number | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
  return typeof value[key] === 'number' ? value[key] : undefined;
}

function jsonString(value: JsonValue, key: string): string | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
  return typeof value[key] === 'string' ? value[key] : undefined;
}

function rateLimitWarnings(metadata: JsonValue): string[] {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return [];
  const resources = metadata.resources;
  if (!resources || Array.isArray(resources) || typeof resources !== 'object') return [];
  return Object.entries(resources)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([resource, quota]) => {
      const remaining = jsonNumber(quota, 'remaining');
      if (remaining === undefined) return [];
      const resetAt = jsonString(quota, 'resetAt');
      return [
        `GitHub API ${escapeMarkdown(resource)} rate limit: ${remaining.toLocaleString('en-US')} requests remaining${resetAt ? `; resets at ${resetAt}` : ''}.`,
      ];
    });
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
