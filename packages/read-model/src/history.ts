import {
  HistoricalContextReadModelV1Schema,
  type HistoricalContextReadModelV1,
  type HistoricalContextRequest,
  type HistoricalContextSeriesV1,
  type OverviewProvenanceReferenceV1,
} from '@public-operations-observatory/contracts';
import type pg from 'pg';

import { getProject } from './project-registry.js';

const DAY_MS = 24 * 60 * 60 * 1_000;
const HISTORY_DAYS = 180;

interface RecordRow {
  id: string;
  record_kind: string;
  external_id: string;
  effective_at: Date;
  payload: unknown;
  evidence_url: string | null;
  source_created_at: Date;
  normalized_at: Date;
}

export interface ReadHistoricalContextOptions {
  signal?: AbortSignal;
}

export async function readHistoricalContext(
  database: pg.Pool,
  request: HistoricalContextRequest,
  options: ReadHistoricalContextOptions = {},
): Promise<HistoricalContextReadModelV1> {
  if (request.period !== '180d') throw new Error('Unsupported history period');
  const project = getProject(request.projectKey);
  const client = await database.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const transactionTime = await client.query<{ now: Date }>(
      'SELECT transaction_timestamp() AS now',
    );
    const transactionAsOf = transactionTime.rows[0]?.now;
    if (!transactionAsOf) throw new Error('Unable to determine transaction timestamp');
    const asOf = request.asOf ? new Date(request.asOf) : transactionAsOf;
    if (!Number.isFinite(asOf.getTime())) throw new Error('History asOf is invalid');
    const start = utcDayBucket(new Date(asOf.getTime() - HISTORY_DAYS * DAY_MS));
    const records = await readRecords(client, project.scope, start, asOf, options.signal);
    const value = assembleHistory(project, records, start, asOf);
    await client.query('COMMIT');
    return HistoricalContextReadModelV1Schema.parse(value);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original query/validation error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function readRecords(
  client: pg.PoolClient,
  scope: string,
  start: Date,
  asOf: Date,
  signal?: AbortSignal,
): Promise<RecordRow[]> {
  const query = {
    text: `WITH ranked_records AS (
      SELECT id, record_kind, external_id, effective_at, payload, evidence_url,
        source_created_at, normalized_at,
        row_number() OVER (
          PARTITION BY record_kind, external_id, effective_at
          ORDER BY source_created_at DESC, normalized_at DESC, id DESC
        ) AS revision_rank
      FROM normalized_records
      WHERE source = 'github' AND scope = $1
        AND schema_version = 1 AND normalizer_version = 1
        AND effective_at >= $2 AND effective_at <= $3
        AND source_created_at <= $3 AND normalized_at <= $3
        AND record_kind = ANY($4::text[])
    )
    SELECT id, record_kind, external_id, effective_at, payload, evidence_url,
      source_created_at, normalized_at
    FROM ranked_records
    WHERE revision_rank = 1
    ORDER BY effective_at ASC, record_kind ASC, external_id ASC,
      source_created_at ASC, normalized_at ASC, id ASC`,
    values: [
      scope,
      start,
      asOf,
      ['repository.summary', 'issues.summary', 'traffic.views', 'traffic.clones'],
    ],
    ...(signal === undefined ? {} : { signal }),
  };
  const result = await client.query<RecordRow>(query);
  return result.rows;
}

function assembleHistory(
  project: ReturnType<typeof getProject>,
  records: RecordRow[],
  start: Date,
  asOf: Date,
): HistoricalContextReadModelV1 {
  const definitions: Array<{
    metricKey: HistoricalContextSeriesV1['metricKey'];
    recordKind: string;
    payloadKey: string;
    label: string;
    unit: HistoricalContextSeriesV1['unit'];
    bucket: HistoricalContextSeriesV1['bucket'];
    method: HistoricalContextSeriesV1['method'];
    limitation: string;
    reasonCode: HistoricalContextSeriesV1['reasonCode'];
  }> = [
    {
      metricKey: 'github.stars',
      recordKind: 'repository.summary',
      payloadKey: 'stars',
      label: 'Active-star cohort at month end',
      unit: 'count',
      bucket: 'calendar-month-end',
      method: 'lower-bound',
      limitation:
        'Derived from current stargazers and their original star timestamps. Accounts that later unstarred are absent; this is not exact historical total stars.',
      reasonCode: 'reconstructed-lower-bound',
    },
    {
      metricKey: 'github.open_issues',
      recordKind: 'issues.summary',
      payloadKey: 'open',
      label: 'Reconstructed open issues at month end',
      unit: 'count',
      bucket: 'calendar-month-end',
      method: 'reconstructed',
      limitation:
        'Derived from public issue creation and close/reopen chronology; pull requests are excluded.',
      reasonCode: 'reconstructed',
    },
    {
      metricKey: 'github.views',
      recordKind: 'traffic.views',
      payloadKey: 'count',
      label: 'Observed page views',
      unit: 'views',
      bucket: 'utc-day',
      method: 'observed',
      limitation:
        'GitHub exposes traffic through a rolling source window. Earlier missing intervals are unavailable, not zero.',
      reasonCode: 'source-rolling-window',
    },
    {
      metricKey: 'github.clones',
      recordKind: 'traffic.clones',
      payloadKey: 'count',
      label: 'Observed repository clones',
      unit: 'clones',
      bucket: 'utc-day',
      method: 'observed',
      limitation:
        'GitHub exposes traffic through a rolling source window. Earlier missing intervals are unavailable, not zero.',
      reasonCode: 'source-rolling-window',
    },
  ];
  const selectedRecords = new Map<string, RecordRow>();
  const series = definitions.map((definition) => {
    const { recordKind, payloadKey, ...publicDefinition } = definition;
    const matching = records.filter((record) => record.record_kind === recordKind);
    const selected =
      definition.bucket === 'calendar-month-end'
        ? monthEndRecords(matching)
        : dailyRecords(matching);
    const points = selected.flatMap((record) => {
      const value = payloadNumber(record.payload, payloadKey);
      if (value === null) return [];
      selectedRecords.set(record.id, record);
      return [
        {
          timestamp: iso(record.effective_at),
          value,
          availability: payloadDerivation(record.payload)
            ? ('partial' as const)
            : ('complete' as const),
          provenanceRefs: [`record:${record.id}`],
        },
      ];
    });
    return {
      ...publicDefinition,
      availability: points.length === 0 ? ('unavailable' as const) : ('partial' as const),
      evidenceUrl: safeEvidenceUrl(selected.at(-1)?.evidence_url),
      points,
    };
  });
  const references: OverviewProvenanceReferenceV1[] = [...selectedRecords.values()].map(
    (record) => ({
      ref: `record:${record.id}`,
      sourceKey: 'github',
      observedAt: iso(record.source_created_at),
      evidenceUrl: safeEvidenceUrl(record.evidence_url),
    }),
  );
  return {
    version: 1,
    project,
    period: '180d',
    window: { start: iso(start), end: iso(asOf) },
    asOf: iso(asOf),
    series,
    provenance: {
      scope: project.scope,
      generatedAt: iso(asOf),
      references,
    },
  };
}

function monthEndRecords(records: RecordRow[]): RecordRow[] {
  const byMonth = new Map<string, RecordRow>();
  for (const record of records) {
    const key = `${record.effective_at.getUTCFullYear()}-${record.effective_at.getUTCMonth()}`;
    byMonth.set(key, record);
  }
  return [...byMonth.values()];
}

function dailyRecords(records: RecordRow[]): RecordRow[] {
  const byDay = new Map<string, RecordRow>();
  for (const record of records) byDay.set(iso(record.effective_at), record);
  return [...byDay.values()];
}

function payloadObject(payload: unknown): Record<string, unknown> | undefined {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : undefined;
}

function payloadDerivation(payload: unknown): Record<string, unknown> | undefined {
  return payloadObject(payloadObject(payload)?.derivation);
}

function payloadNumber(payload: unknown, key: string): number | null {
  const value = payloadObject(payload)?.[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeEvidenceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['github.com', 'api.github.com'].includes(url.hostname)) {
      return null;
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function utcDayBucket(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function iso(date: Date): string {
  return date.toISOString();
}
