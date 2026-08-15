import {
  OverviewReadModelV1RequestSchema,
  OverviewReadModelV1Schema,
  type OverviewAvailability,
  type OverviewChangeV1,
  type OverviewProvenanceReferenceV1,
  type OverviewReadModelV1,
  type OverviewReadModelV1Request,
  type OverviewSourceAttentionExceptionV1,
  type OverviewTrendAnnotationV1,
  type OverviewWarningV1,
} from '@public-operations-observatory/contracts';
import pg from 'pg';

import { getProject } from './project-registry.js';

const METRIC_VERSION = 1;
const DEFAULT_FRESHNESS_HOURS = 30;
const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_PROVENANCE_REFS_PER_VALUE = 20;
const MAX_PROVENANCE_REFERENCES = 500;
const MAX_TREND_POINTS = 366;

type MetricKey =
  | 'github.stars'
  | 'github.views'
  | 'github.clones'
  | 'github.release_asset_downloads'
  | 'github.open_issues';

export interface ReadOverviewOptions {
  freshnessHours?: number;
  signal?: AbortSignal;
}

interface RecordRow {
  id: string;
  record_kind: string;
  external_id: string;
  effective_at: Date;
  payload: unknown;
  evidence_url: string;
  source_created_at: Date;
  normalized_at: Date;
}

interface RunRow {
  id: string;
  status: 'succeeded' | 'partial' | 'failed';
  started_at: Date;
  finished_at: Date;
}

interface CheckpointRow {
  collection_run_id: string;
  cursor_at: Date;
  recorded_at: Date;
}

interface AnnotationRow {
  id: string;
  occurred_at: Date;
  kind: 'release' | 'documentation' | 'communication' | 'other';
  title: string;
  evidence_url: string;
  created_at: Date;
}

interface BriefingRow {
  id: string;
  content_markdown: string;
  created_at: Date;
}

interface WindowBounds {
  comparisonStart: Date;
  comparisonEnd: Date;
  start: Date;
  end: Date;
}

interface MetricValue {
  current: number | null;
  previous: number | null;
  evidenceUrl: string | null;
  provenanceRefs: string[];
  complete: boolean;
  coverage?: {
    currentObservedDays: number;
    previousObservedDays: number;
    requiredDays: 7;
  };
}

const metricPresentation: ReadonlyArray<{
  key: MetricKey;
  label: string;
  unit: 'count' | 'views' | 'clones' | 'downloads';
}> = [
  { key: 'github.stars', label: 'Net stars', unit: 'count' },
  { key: 'github.views', label: 'Page views', unit: 'views' },
  { key: 'github.clones', label: 'Repository clones', unit: 'clones' },
  {
    key: 'github.release_asset_downloads',
    label: 'Release asset downloads',
    unit: 'downloads',
  },
  { key: 'github.open_issues', label: 'Open issues', unit: 'count' },
];

export async function readOverview(
  database: pg.Pool,
  input: OverviewReadModelV1Request,
  options: ReadOverviewOptions = {},
): Promise<OverviewReadModelV1> {
  const request = OverviewReadModelV1RequestSchema.parse(input);
  const project = getProject(request.projectKey);
  const freshnessHours = options.freshnessHours ?? DEFAULT_FRESHNESS_HOURS;
  if (!Number.isFinite(freshnessHours) || freshnessHours <= 0) {
    throw new Error('freshnessHours must be a positive finite number');
  }

  const client = await connectWithSignal(database, options.signal);
  const processId = (client as pg.PoolClient & { processID: number }).processID;
  let released = false;
  let aborted = false;
  let cancellation: Promise<void> | undefined;
  const onClientError = (): void => undefined;
  client.on('error', onClientError);
  const release = (error?: Error): void => {
    if (released) return;
    released = true;
    client.off('error', onClientError);
    client.release(error);
  };
  const onAbort = (): void => {
    aborted = true;
    cancellation ??= terminateBackend(database, processId).catch((error: unknown) => {
      release(error instanceof Error ? error : abortError(options.signal));
    });
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  try {
    if (aborted) throw abortError(options.signal);
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const transactionTime = await client.query<{ transaction_timestamp: Date }>(
      'SELECT transaction_timestamp() AS transaction_timestamp',
    );
    await client.query(
      `SELECT current_setting('transaction_isolation') AS isolation,
        current_setting('transaction_read_only') AS read_only,
        txid_current_snapshot()::text AS snapshot`,
    );
    const timestamp = transactionTime.rows[0]?.transaction_timestamp;
    if (!timestamp) throw new Error('PostgreSQL did not return transaction_timestamp()');

    const asOfDate = request.asOf ? new Date(request.asOf) : timestamp;
    const view = request.view ?? 'completed';
    const windowEnd =
      view === 'current'
        ? currentUtcDayEnd(asOfDate)
        : request.windowEnd
          ? validateWindowEnd(new Date(request.windowEnd), asOfDate)
          : latestCompletedUtcWeekEnd(asOfDate);
    const bounds = windowBounds(windowEnd);

    const records = await readRecords(
      client,
      project.scope,
      bounds,
      view === 'current' ? asOfDate : bounds.end,
    );
    const latestRun = await readLatestRun(client, project.scope, asOfDate);
    const checkpoint = await readCheckpoint(client, project.scope, asOfDate);
    const annotations = await readAnnotations(client, project.scope, bounds, asOfDate);
    const briefing = await readBriefing(client, project.scope, bounds, asOfDate);

    const response = assembleOverview({
      annotations,
      asOf: asOfDate,
      bounds,
      briefing,
      checkpoint,
      freshnessHours,
      latestRun,
      project,
      records,
      view,
    });
    const parsed = OverviewReadModelV1Schema.parse(response);
    await client.query('COMMIT');
    if (aborted) throw abortError(options.signal);
    return parsed;
  } catch (error) {
    if (aborted) {
      await cancellation;
      throw abortError(options.signal);
    }
    if (!released) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    release(aborted ? abortError(options.signal) : undefined);
  }
}

async function terminateBackend(database: pg.Pool, processId: number): Promise<void> {
  const canceller = new pg.Client(database.options);
  try {
    await canceller.connect();
    const result = await canceller.query<{ terminated: boolean }>(
      'SELECT pg_terminate_backend($1, 1000) AS terminated',
      [processId],
    );
    if (result.rows[0]?.terminated !== true) {
      throw new Error('PostgreSQL did not terminate the aborted Overview backend');
    }
  } finally {
    await canceller.end().catch(() => undefined);
  }
}

async function connectWithSignal(
  database: pg.Pool,
  signal: AbortSignal | undefined,
): Promise<pg.PoolClient> {
  if (signal?.aborted) throw abortError(signal);
  if (signal === undefined) return database.connect();

  return new Promise<pg.PoolClient>((resolve, reject) => {
    let settled = false;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      reject(abortError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void database.connect().then(
      (client) => {
        signal.removeEventListener('abort', onAbort);
        if (settled || signal.aborted) {
          client.release();
          if (!settled) reject(abortError(signal));
          return;
        }
        settled = true;
        resolve(client);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error('PostgreSQL connection failed'));
      },
    );
  });
}

function abortError(signal: AbortSignal | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

async function readRecords(
  client: pg.PoolClient,
  scope: string,
  bounds: WindowBounds,
  metricCutoff: Date,
): Promise<RecordRow[]> {
  const result = await client.query<RecordRow>(
    `WITH ranked_records AS (
       SELECT id, record_kind, external_id, effective_at, payload, evidence_url,
         source_created_at, normalized_at,
         row_number() OVER (
           PARTITION BY record_kind, external_id, effective_at
           ORDER BY source_created_at DESC, normalized_at DESC, id DESC
         ) AS revision_rank
       FROM normalized_records
       WHERE source = $1 AND scope = $2
         AND schema_version = $3 AND normalizer_version = $4
         AND effective_at < $5
         AND source_created_at <= $6 AND normalized_at <= $6
         AND record_kind = ANY($7::text[])
     ), selected_records AS (
       SELECT id, record_kind, external_id, effective_at, payload, evidence_url,
         source_created_at, normalized_at
       FROM ranked_records
       WHERE revision_rank = 1 AND effective_at >= $8
       UNION ALL
       SELECT DISTINCT ON (record_kind, external_id)
         id, record_kind, external_id, effective_at, payload, evidence_url,
         source_created_at, normalized_at
       FROM ranked_records
       WHERE revision_rank = 1 AND effective_at < $8
         AND record_kind = ANY($9::text[])
       ORDER BY record_kind, external_id, effective_at DESC,
         source_created_at DESC, normalized_at DESC, id DESC
     )
     SELECT id, record_kind, external_id, effective_at, payload, evidence_url,
       source_created_at, normalized_at
     FROM selected_records
     ORDER BY effective_at ASC, record_kind ASC, external_id ASC,
       source_created_at ASC, normalized_at ASC, id ASC`,
    [
      'github',
      scope,
      1,
      1,
      bounds.end,
      metricCutoff,
      [
        'repository.summary',
        'traffic.views',
        'traffic.clones',
        'release.summary',
        'issues.summary',
      ],
      bounds.comparisonStart,
      ['repository.summary', 'release.summary', 'issues.summary'],
    ],
  );
  return result.rows;
}

async function readLatestRun(
  client: pg.PoolClient,
  scope: string,
  asOf: Date,
): Promise<RunRow | undefined> {
  const result = await client.query<RunRow>(
    `SELECT id, status, started_at, finished_at
     FROM collection_runs
     WHERE source = $1 AND scope = $2 AND status <> 'running'
       AND finished_at IS NOT NULL AND started_at <= $3 AND finished_at <= $3
     ORDER BY finished_at DESC, started_at DESC, id DESC
     LIMIT 1`,
    ['github', scope, asOf],
  );
  return result.rows[0];
}

async function readCheckpoint(
  client: pg.PoolClient,
  scope: string,
  asOf: Date,
): Promise<CheckpointRow | undefined> {
  const result = await client.query<CheckpointRow>(
    `SELECT history.collection_run_id, history.cursor_at, history.recorded_at
     FROM source_checkpoint_history history
     JOIN collection_runs run ON run.id = history.collection_run_id
     WHERE history.source = $1 AND history.scope = $2
       AND history.checkpoint_key = $3 AND run.status = 'succeeded'
       AND history.cursor_at <= $4 AND history.recorded_at <= $4
       AND run.started_at <= $4 AND run.finished_at <= $4
     ORDER BY history.cursor_at DESC, history.recorded_at DESC,
       history.collection_run_id DESC, history.checkpoint_key DESC
     LIMIT 1`,
    ['github', scope, 'daily-collection', asOf],
  );
  return result.rows[0];
}

async function readAnnotations(
  client: pg.PoolClient,
  scope: string,
  bounds: WindowBounds,
  asOf: Date,
): Promise<AnnotationRow[]> {
  const result = await client.query<AnnotationRow>(
    `SELECT id, occurred_at, kind, title, evidence_url, created_at
     FROM annotations
     WHERE scope = $1 AND occurred_at >= $2 AND occurred_at < $3 AND created_at <= $4
     ORDER BY occurred_at ASC, kind ASC, title ASC, id ASC
     LIMIT 100`,
    [scope, bounds.start, bounds.end, asOf],
  );
  return result.rows;
}

async function readBriefing(
  client: pg.PoolClient,
  scope: string,
  bounds: WindowBounds,
  asOf: Date,
): Promise<BriefingRow | undefined> {
  const result = await client.query<BriefingRow>(
    `SELECT id, content_markdown, created_at
     FROM briefing_revisions
     WHERE scope = $1 AND window_start = $2 AND window_end = $3
       AND metric_version = $4 AND created_at <= $5
     ORDER BY created_at DESC, content_digest DESC, id DESC
     LIMIT 1`,
    [scope, bounds.start, bounds.end, METRIC_VERSION, asOf],
  );
  return result.rows[0];
}

function assembleOverview(input: {
  annotations: AnnotationRow[];
  asOf: Date;
  bounds: WindowBounds;
  briefing: BriefingRow | undefined;
  checkpoint: CheckpointRow | undefined;
  freshnessHours: number;
  latestRun: RunRow | undefined;
  project: ReturnType<typeof getProject>;
  records: RecordRow[];
  view: 'current' | 'completed';
}): unknown {
  const sourceAvailability = determineSourceAvailability(
    input.latestRun,
    input.records,
    input.asOf,
    input.freshnessHours,
  );
  const values = evaluateValues(input.records, input.bounds);
  const incompleteKeys = metricPresentation
    .filter(({ key }) => !values.get(key)?.complete)
    .map(({ key }) => key);
  const warnings = buildWarnings(
    sourceAvailability,
    input.latestRun,
    input.checkpoint,
    incompleteKeys,
  );
  const overallAvailability = determineOverallAvailability(
    sourceAvailability,
    input.records,
    input.checkpoint,
    incompleteKeys,
  );
  const effectiveValueAvailability =
    overallAvailability === 'failed' || overallAvailability === 'empty'
      ? overallAvailability
      : sourceAvailability === 'stale'
        ? 'stale'
        : overallAvailability === 'partial'
          ? 'partial'
          : 'complete';
  const changes = metricPresentation.map((presentation) =>
    buildChange(presentation, values.get(presentation.key), effectiveValueAvailability),
  );
  const annotations = input.annotations.map(buildAnnotation);
  const releaseTrend = buildReleaseTrend(input.records, input.bounds, effectiveValueAvailability);
  const latestSuccessfulAt =
    input.latestRun?.status === 'succeeded'
      ? input.latestRun.finished_at
      : input.checkpoint?.cursor_at;
  const staleAfter = latestSuccessfulAt
    ? new Date(latestSuccessfulAt.getTime() + input.freshnessHours * 3_600_000)
    : null;
  const sourceRefs = [
    ...(input.latestRun ? [`run:${input.latestRun.id}`] : []),
    ...(input.checkpoint ? [`checkpoint:${input.checkpoint.collection_run_id}`] : []),
  ];
  const attention = buildAttention(warnings, input.asOf, sourceRefs);
  const release = buildLatestRelease(
    input.records,
    sourceAvailability === 'complete' ? effectiveValueAvailability : sourceAvailability,
  );
  const briefing = buildBriefing(input.briefing, effectiveValueAvailability);
  const refsOutsideTrend = new Set([
    ...changes.flatMap((change) => change.provenanceRefs),
    ...annotations.flatMap((annotation) => annotation.provenanceRefs),
    ...(release?.provenanceRefs ?? []),
    ...briefing.provenanceRefs,
    ...sourceRefs,
  ]);
  const trendSelection = selectTrendPoints(
    releaseTrend.points,
    Math.max(0, MAX_PROVENANCE_REFERENCES - refsOutsideTrend.size),
  );
  const trendPoints = trendSelection.points;
  const trendAvailability = trendSelection.truncated
    ? releaseTrend.availability === 'stale'
      ? 'stale'
      : 'partial'
    : releaseTrend.availability;
  const usedRefs = new Set([
    ...changes.flatMap((change) => change.provenanceRefs),
    ...trendPoints.flatMap((point) => point.provenanceRefs),
    ...annotations.flatMap((annotation) => annotation.provenanceRefs),
    ...(release?.provenanceRefs ?? []),
    ...briefing.provenanceRefs,
    ...sourceRefs,
  ]);
  const references = buildProvenanceReferences(input).filter(({ ref }) => usedRefs.has(ref));

  return {
    version: 1,
    view: input.view,
    project: input.project,
    period: '7d',
    window: {
      start: iso(input.bounds.start),
      end: iso(input.bounds.end),
      comparisonStart: iso(input.bounds.comparisonStart),
      comparisonEnd: iso(input.bounds.comparisonEnd),
    },
    asOf: iso(input.asOf),
    availability: overallAvailability,
    freshness: {
      availability: sourceAvailability,
      checkedAt: iso(input.asOf),
      lastSuccessfulAt: latestSuccessfulAt ? iso(latestSuccessfulAt) : null,
      staleAfter: staleAfter ? iso(staleAfter) : null,
    },
    warnings,
    changes,
    trend: {
      metricKey: 'github.release_asset_downloads',
      label: 'Release asset downloads',
      unit: 'downloads',
      availability: trendAvailability,
      points: trendPoints,
      annotations,
    },
    release,
    briefing,
    sources: [
      {
        key: 'github',
        label: 'GitHub',
        availability: sourceAvailability,
        lastAttemptAt: input.latestRun ? iso(input.latestRun.finished_at) : null,
        lastSuccessfulAt: latestSuccessfulAt ? iso(latestSuccessfulAt) : null,
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay',
        warnings: warnings.map((warning) => warning.message),
        provenanceRefs: sourceRefs,
      },
    ],
    attention,
    provenance: {
      scope: input.project.scope,
      metricDefinitionVersion: METRIC_VERSION,
      windowEnd: iso(input.bounds.end),
      asOf: iso(input.asOf),
      generatedAt: iso(input.asOf),
      references,
    },
  };
}

function evaluateValues(records: RecordRow[], bounds: WindowBounds): Map<MetricKey, MetricValue> {
  const values = new Map<MetricKey, MetricValue>();
  values.set('github.stars', latestMetric(records, 'repository.summary', 'stars', bounds));
  values.set('github.open_issues', latestMetric(records, 'issues.summary', 'open', bounds));
  values.set('github.views', windowSumMetric(records, 'traffic.views', 'count', bounds));
  values.set('github.clones', windowSumMetric(records, 'traffic.clones', 'count', bounds));
  values.set('github.release_asset_downloads', releaseIntervalMetric(records, bounds));
  return values;
}

function latestMetric(
  records: RecordRow[],
  recordKind: string,
  payloadKey: string,
  bounds: WindowBounds,
): MetricValue {
  const candidates = records.filter((record) => record.record_kind === recordKind);
  const current = last(
    candidates.filter(
      (record) => record.effective_at >= bounds.start && record.effective_at < bounds.end,
    ),
  );
  const previous = last(candidates.filter((record) => record.effective_at < bounds.start));
  const currentValue = current ? payloadNumber(current.payload, payloadKey) : null;
  const previousValue = previous ? payloadNumber(previous.payload, payloadKey) : null;
  return {
    current: currentValue,
    previous: previousValue,
    complete: currentValue !== null && previousValue !== null,
    evidenceUrl: safeEvidenceUrl(current?.evidence_url),
    provenanceRefs: unique([
      ...(current ? [`record:${current.id}`] : []),
      ...(previous ? [`record:${previous.id}`] : []),
    ]),
  };
}

function windowSumMetric(
  records: RecordRow[],
  recordKind: string,
  payloadKey: string,
  bounds: WindowBounds,
): MetricValue {
  const candidates = records.filter((record) => record.record_kind === recordKind);
  const currentRows = candidates.filter(
    (record) => record.effective_at >= bounds.start && record.effective_at < bounds.end,
  );
  const previousRows = candidates.filter(
    (record) =>
      record.effective_at >= bounds.comparisonStart && record.effective_at < bounds.comparisonEnd,
  );
  const current = sumPayload(currentRows, payloadKey);
  const previous = sumPayload(previousRows, payloadKey);
  const provenanceRefs = unique(
    [...previousRows, ...currentRows].map((record) => `record:${record.id}`),
  );
  const exactEvaluationFits = provenanceRefs.length <= MAX_PROVENANCE_REFS_PER_VALUE;
  const complete =
    hasDailyCoverage(currentRows, bounds.start, bounds.end) &&
    hasDailyCoverage(previousRows, bounds.comparisonStart, bounds.comparisonEnd) &&
    exactEvaluationFits;
  return {
    current: exactEvaluationFits ? current : null,
    previous: exactEvaluationFits ? previous : null,
    complete,
    evidenceUrl: safeEvidenceUrl(last(currentRows)?.evidence_url),
    provenanceRefs: provenanceRefs.slice(0, MAX_PROVENANCE_REFS_PER_VALUE),
    coverage: {
      currentObservedDays: observedDayCount(currentRows),
      previousObservedDays: observedDayCount(previousRows),
      requiredDays: 7,
    },
  };
}

function releaseIntervalMetric(records: RecordRow[], bounds: WindowBounds): MetricValue {
  const releases = records.filter((record) => record.record_kind === 'release.summary');
  const current = counterMovement(releases, bounds.start, bounds.end);
  const previous = counterMovement(releases, bounds.comparisonStart, bounds.comparisonEnd);
  const currentRows = releases.filter(
    (record) => record.effective_at >= bounds.start && record.effective_at < bounds.end,
  );
  const provenanceRefs = unique([...previous.refs, ...current.refs]);
  const exactEvaluationFits = provenanceRefs.length <= MAX_PROVENANCE_REFS_PER_VALUE;
  return {
    current: exactEvaluationFits ? current.value : null,
    previous: exactEvaluationFits ? previous.value : null,
    complete: current.complete && previous.complete && exactEvaluationFits,
    evidenceUrl: safeEvidenceUrl(last(currentRows)?.evidence_url ?? last(releases)?.evidence_url),
    provenanceRefs: provenanceRefs.slice(0, MAX_PROVENANCE_REFS_PER_VALUE),
  };
}

function counterMovement(
  records: RecordRow[],
  start: Date,
  end: Date,
): { value: number | null; complete: boolean; refs: string[] } {
  const entities = new Map<string, RecordRow[]>();
  for (const record of records) {
    const existing = entities.get(record.external_id) ?? [];
    existing.push(record);
    entities.set(record.external_id, existing);
  }
  let total = 0;
  let observedTransition = false;
  let complete = entities.size > 0;
  const refs: string[] = [];
  for (const externalId of [...entities.keys()].sort()) {
    const entityRows = entities.get(externalId) ?? [];
    const baseline = last(entityRows.filter((record) => record.effective_at < start));
    const inWindow = entityRows.filter(
      (record) => record.effective_at >= start && record.effective_at < end,
    );
    if (inWindow.length === 0) continue;
    const publishedAt = dateFromPayload(inWindow[0]?.payload, 'publishedAt');
    const firstPublishedInWindow =
      publishedAt !== null && publishedAt >= start && publishedAt < end;
    if (!baseline && !firstPublishedInWindow) {
      complete = false;
      refs.push(...inWindow.map((record) => `record:${record.id}`));
      continue;
    }
    let previous = baseline ? payloadNumber(baseline.payload, 'totalAssetDownloads') : 0;
    if (previous === null) {
      complete = false;
      continue;
    }
    if (baseline) refs.push(`record:${baseline.id}`);
    for (const record of inWindow) {
      const next = payloadNumber(record.payload, 'totalAssetDownloads');
      refs.push(`record:${record.id}`);
      if (next === null) {
        complete = false;
        continue;
      }
      total += next >= previous ? next - previous : next;
      previous = next;
      observedTransition = true;
    }
  }
  const uniqueRefs = unique(refs);
  return {
    value: observedTransition ? total : null,
    complete: complete && observedTransition,
    refs: uniqueRefs,
  };
}

type TrendPoint = {
  timestamp: string;
  availability: OverviewAvailability;
  value: number | null;
  provenanceRefs: string[];
};

function buildReleaseTrend(
  records: RecordRow[],
  bounds: WindowBounds,
  availability: OverviewAvailability,
): { availability: OverviewAvailability; points: TrendPoint[] } {
  const releases = records.filter((record) => record.record_kind === 'release.summary');
  const inWindow = releases.filter(
    (record) => record.effective_at >= bounds.start && record.effective_at < bounds.end,
  );
  if (inWindow.length === 0) {
    return {
      availability: availability === 'failed' ? 'failed' : 'empty',
      points: [],
    };
  }

  const previousByRecord = new Map<string, RecordRow | undefined>();
  const latestByRelease = new Map<string, RecordRow>();
  for (const record of releases) {
    previousByRecord.set(record.id, latestByRelease.get(record.external_id));
    latestByRelease.set(record.external_id, record);
  }

  const rowsByTimestamp = new Map<string, RecordRow[]>();
  for (const record of inWindow) {
    const timestamp = iso(record.effective_at);
    rowsByTimestamp.set(timestamp, [...(rowsByTimestamp.get(timestamp) ?? []), record]);
  }

  let hasIncompletePoint = false;
  const points = [...rowsByTimestamp.entries()].map(([timestamp, rows]) => {
    let value = 0;
    let exact = availability !== 'failed' && availability !== 'empty';
    const refs: string[] = [];
    for (const record of rows) {
      const previous = previousByRecord.get(record.id);
      const publishedAt = dateFromPayload(record.payload, 'publishedAt');
      const firstPublishedInWindow =
        publishedAt !== null && publishedAt >= bounds.start && publishedAt < bounds.end;
      const previousValue = previous
        ? payloadNumber(previous.payload, 'totalAssetDownloads')
        : firstPublishedInWindow
          ? 0
          : null;
      const nextValue = payloadNumber(record.payload, 'totalAssetDownloads');
      if (previous) refs.push(`record:${previous.id}`);
      refs.push(`record:${record.id}`);
      if (previousValue === null || nextValue === null) {
        exact = false;
        continue;
      }
      value += nextValue >= previousValue ? nextValue - previousValue : nextValue;
    }
    const provenanceRefs = unique(refs);
    if (provenanceRefs.length > MAX_PROVENANCE_REFS_PER_VALUE) exact = false;
    if (!exact) hasIncompletePoint = true;
    const pointAvailability: OverviewAvailability =
      availability === 'failed' || availability === 'empty'
        ? availability
        : availability === 'stale'
          ? 'stale'
          : exact && availability === 'complete'
            ? 'complete'
            : 'partial';
    return {
      timestamp,
      availability: pointAvailability,
      value: exact ? value : null,
      provenanceRefs: provenanceRefs.slice(0, MAX_PROVENANCE_REFS_PER_VALUE),
    };
  });

  return {
    availability:
      availability === 'failed' || availability === 'empty' || availability === 'stale'
        ? availability
        : hasIncompletePoint || availability === 'partial'
          ? 'partial'
          : 'complete',
    points,
  };
}

function selectTrendPoints(
  candidates: TrendPoint[],
  referenceLimit: number,
): { points: TrendPoint[]; truncated: boolean } {
  const selected: TrendPoint[] = [];
  const refs = new Set<string>();
  for (const point of [...candidates].reverse()) {
    const addedRefs = point.provenanceRefs.filter((ref) => !refs.has(ref));
    if (selected.length >= MAX_TREND_POINTS || refs.size + addedRefs.length > referenceLimit) break;
    selected.push(point);
    addedRefs.forEach((ref) => refs.add(ref));
  }
  selected.reverse();
  return { points: selected, truncated: selected.length !== candidates.length };
}

function buildChange(
  presentation: (typeof metricPresentation)[number],
  value: MetricValue | undefined,
  availability: OverviewAvailability,
): OverviewChangeV1 {
  const current = value?.current ?? null;
  const previous = value?.previous ?? null;
  const delta =
    value?.complete === true && current !== null && previous !== null ? current - previous : null;
  const common = {
    metricKey: presentation.key,
    label: presentation.label,
    unit: presentation.unit,
    evidenceUrl: value?.evidenceUrl ?? null,
    provenanceRefs: value?.provenanceRefs ?? [],
    ...(value?.coverage === undefined ? {} : { coverage: value.coverage }),
  };
  if (availability === 'failed' || availability === 'empty') {
    return { ...common, availability, current: null, previous: null, delta: null };
  }
  if (availability === 'complete' && value?.complete && current !== null && previous !== null) {
    return { ...common, availability: 'complete', current, previous, delta: current - previous };
  }
  return {
    ...common,
    availability: availability === 'stale' ? 'stale' : 'partial',
    current,
    previous,
    delta,
  };
}

function determineSourceAvailability(
  run: RunRow | undefined,
  records: RecordRow[],
  asOf: Date,
  freshnessHours: number,
): OverviewAvailability {
  if (!run) return records.length === 0 ? 'empty' : 'partial';
  if (run.status === 'failed') return 'failed';
  if (run.status === 'partial') return 'partial';
  if (asOf.getTime() - run.finished_at.getTime() > freshnessHours * 3_600_000) return 'stale';
  return records.length === 0 ? 'empty' : 'complete';
}

function determineOverallAvailability(
  source: OverviewAvailability,
  records: RecordRow[],
  checkpoint: CheckpointRow | undefined,
  incompleteKeys: MetricKey[],
): OverviewAvailability {
  if (source === 'failed') return 'failed';
  if (records.length === 0) return 'empty';
  if (source === 'partial' || !checkpoint || incompleteKeys.length > 0) return 'partial';
  if (source === 'stale') return 'stale';
  return 'complete';
}

function buildWarnings(
  source: OverviewAvailability,
  run: RunRow | undefined,
  checkpoint: CheckpointRow | undefined,
  incompleteKeys: MetricKey[],
): OverviewWarningV1[] {
  const warnings: OverviewWarningV1[] = [];
  if (source === 'failed') {
    warnings.push({
      code: 'source_failure',
      sourceKey: 'github',
      message: 'The latest GitHub collection failed.',
    });
  } else if (run?.status === 'partial') {
    warnings.push({
      code: 'partial_run',
      sourceKey: 'github',
      message: 'The latest GitHub collection was partial.',
    });
  } else if (source === 'stale') {
    warnings.push({
      code: 'stale_collection',
      sourceKey: 'github',
      message: 'GitHub collection is older than the freshness expectation.',
    });
  }
  if (!checkpoint) {
    warnings.push({
      code: 'missing_successful_checkpoint',
      sourceKey: 'github',
      message: 'No successful GitHub checkpoint is available as of this read.',
    });
  }
  for (const metricKey of incompleteKeys) {
    warnings.push({
      code: 'incomplete_metric_window',
      sourceKey: 'github',
      metricKey,
      message: `${metricKey} does not have complete current and comparison evidence.`,
    });
  }
  return warnings;
}

function buildAttention(
  warnings: OverviewWarningV1[],
  detectedAt: Date,
  provenanceRefs: string[],
): OverviewSourceAttentionExceptionV1[] {
  return warnings.map((warning) => ({
    kind: warning.code,
    sourceKey: 'github',
    severity:
      warning.code === 'source_failure' || warning.code === 'missing_successful_checkpoint'
        ? 'critical'
        : 'warning',
    title: attentionTitle(warning.code),
    detail: warning.message,
    detectedAt: iso(detectedAt),
    evidenceUrl: 'https://github.com/Codename-11/hermes-relay',
    provenanceRefs,
  }));
}

function attentionTitle(code: OverviewWarningV1['code']): string {
  switch (code) {
    case 'source_failure':
      return 'GitHub collection failed';
    case 'partial_run':
      return 'GitHub collection was partial';
    case 'stale_collection':
      return 'GitHub collection is stale';
    case 'missing_successful_checkpoint':
      return 'Successful checkpoint missing';
    case 'incomplete_metric_window':
      return 'Metric window incomplete';
  }
}

function buildLatestRelease(records: RecordRow[], availability: OverviewAvailability) {
  const releases = records.filter((record) => record.record_kind === 'release.summary');
  const latest = [...releases].sort((left, right) => {
    const published = dateFromPayload(right.payload, 'publishedAt')?.getTime() ?? 0;
    const other = dateFromPayload(left.payload, 'publishedAt')?.getTime() ?? 0;
    return published - other || compareRecords(right, left);
  })[0];
  if (!latest) {
    return {
      availability:
        availability === 'failed' || availability === 'partial' || availability === 'stale'
          ? availability
          : 'empty',
      tagName: null,
      name: null,
      publishedAt: null,
      evidenceUrl: null,
      assetDownloads: null,
      provenanceRefs: [],
    };
  }
  const tagName = payloadString(latest.payload, 'tag');
  const publishedAt = dateFromPayload(latest.payload, 'publishedAt');
  const evidenceUrl = safeEvidenceUrl(latest.evidence_url);
  const downloads = payloadNumber(latest.payload, 'totalAssetDownloads');
  const refs = [`record:${latest.id}`];
  if (availability === 'failed' || availability === 'empty') {
    return {
      availability,
      tagName: null,
      name: null,
      publishedAt: null,
      evidenceUrl: null,
      assetDownloads: null,
      provenanceRefs: refs,
    };
  }
  if (
    !tagName ||
    !publishedAt ||
    !evidenceUrl ||
    downloads === null ||
    availability !== 'complete'
  ) {
    return {
      availability: availability === 'stale' ? 'stale' : 'partial',
      tagName,
      name: payloadString(latest.payload, 'name'),
      publishedAt: publishedAt ? iso(publishedAt) : null,
      evidenceUrl,
      assetDownloads: downloads,
      provenanceRefs: refs,
    };
  }
  return {
    availability: 'complete',
    tagName,
    name: payloadString(latest.payload, 'name'),
    publishedAt: iso(publishedAt),
    evidenceUrl,
    assetDownloads: downloads,
    provenanceRefs: refs,
  };
}

function buildBriefing(row: BriefingRow | undefined, availability: OverviewAvailability) {
  if (!row) {
    return {
      availability:
        availability === 'failed' || availability === 'partial' || availability === 'stale'
          ? availability
          : 'empty',
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: [],
    };
  }
  const summary = row.content_markdown.trim().slice(0, 2_000);
  const refs = [`briefing:${row.id}`];
  if (!summary) {
    return {
      availability: 'empty',
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: refs,
    };
  }
  if (availability === 'failed' || availability === 'empty') {
    return {
      availability,
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: refs,
    };
  }
  return {
    availability: availability === 'complete' ? 'complete' : availability,
    summary,
    generatedAt: iso(row.created_at),
    evidenceUrl: null,
    provenanceRefs: refs,
  };
}

function buildAnnotation(row: AnnotationRow): OverviewTrendAnnotationV1 {
  return {
    id: row.id,
    kind: row.kind,
    label: row.title,
    occurredAt: iso(row.occurred_at),
    evidenceUrl: safeEvidenceUrl(row.evidence_url),
    provenanceRefs: [`annotation:${row.id}`],
  };
}

function buildProvenanceReferences(input: {
  records: RecordRow[];
  latestRun: RunRow | undefined;
  checkpoint: CheckpointRow | undefined;
  annotations: AnnotationRow[];
  briefing: BriefingRow | undefined;
}): OverviewProvenanceReferenceV1[] {
  return [
    ...input.records.map((record) => ({
      ref: `record:${record.id}`,
      sourceKey: 'github',
      observedAt: iso(record.effective_at),
      evidenceUrl: safeEvidenceUrl(record.evidence_url),
    })),
    ...(input.latestRun
      ? [
          {
            ref: `run:${input.latestRun.id}`,
            sourceKey: 'github',
            observedAt: iso(input.latestRun.finished_at),
            evidenceUrl: null,
          },
        ]
      : []),
    ...(input.checkpoint
      ? [
          {
            ref: `checkpoint:${input.checkpoint.collection_run_id}`,
            sourceKey: 'github',
            observedAt: iso(input.checkpoint.cursor_at),
            evidenceUrl: null,
          },
        ]
      : []),
    ...input.annotations.map((annotation) => ({
      ref: `annotation:${annotation.id}`,
      sourceKey: 'github',
      observedAt: iso(annotation.occurred_at),
      evidenceUrl: safeEvidenceUrl(annotation.evidence_url),
    })),
    ...(input.briefing
      ? [
          {
            ref: `briefing:${input.briefing.id}`,
            sourceKey: 'github',
            observedAt: iso(input.briefing.created_at),
            evidenceUrl: null,
          },
        ]
      : []),
  ].sort(
    (left, right) =>
      left.observedAt.localeCompare(right.observedAt) || left.ref.localeCompare(right.ref),
  );
}

function latestCompletedUtcWeekEnd(date: Date): Date {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (end.getUTCDay() + 6) % 7;
  end.setUTCDate(end.getUTCDate() - daysSinceMonday);
  return end;
}

function currentUtcDayEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function validateWindowEnd(windowEnd: Date, asOf: Date): Date {
  const latest = latestCompletedUtcWeekEnd(asOf);
  const canonical =
    windowEnd.getUTCDay() === 1 &&
    windowEnd.getUTCHours() === 0 &&
    windowEnd.getUTCMinutes() === 0 &&
    windowEnd.getUTCSeconds() === 0 &&
    windowEnd.getUTCMilliseconds() === 0 &&
    windowEnd <= latest;
  if (!canonical) throw new Error('windowEnd must be a completed Monday-to-Monday UTC boundary');
  return windowEnd;
}

function windowBounds(end: Date): WindowBounds {
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return {
    end,
    start,
    comparisonEnd: start,
    comparisonStart: new Date(start.getTime() - 7 * DAY_MS),
  };
}

function hasDailyCoverage(records: RecordRow[], start: Date, end: Date): boolean {
  const days = new Set(records.map((record) => iso(record.effective_at).slice(0, 10)));
  for (let time = start.getTime(); time < end.getTime(); time += DAY_MS) {
    if (!days.has(new Date(time).toISOString().slice(0, 10))) return false;
  }
  return true;
}

function observedDayCount(records: RecordRow[]): number {
  return new Set(records.map((record) => iso(record.effective_at).slice(0, 10))).size;
}

function sumPayload(records: RecordRow[], key: string): number | null {
  if (records.length === 0) return null;
  let total = 0;
  for (const record of records) {
    const value = payloadNumber(record.payload, key);
    if (value === null) return null;
    total += value;
  }
  return total;
}

function payloadObject(payload: unknown): Record<string, unknown> | undefined {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : undefined;
}

function payloadNumber(payload: unknown, key: string): number | null {
  const value = payloadObject(payload)?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function payloadString(payload: unknown, key: string): string | null {
  const value = payloadObject(payload)?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dateFromPayload(payload: unknown, key: string): Date | null {
  const value = payloadString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeEvidenceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['github.com', 'api.github.com'].includes(url.hostname.toLowerCase())
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

function compareRecords(left: RecordRow, right: RecordRow): number {
  return (
    left.effective_at.getTime() - right.effective_at.getTime() ||
    left.source_created_at.getTime() - right.source_created_at.getTime() ||
    left.normalized_at.getTime() - right.normalized_at.getTime() ||
    left.id.localeCompare(right.id)
  );
}

function last<T>(values: T[]): T | undefined {
  return values.at(-1);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function iso(date: Date): string {
  return date.toISOString();
}
