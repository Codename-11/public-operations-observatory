import type { Database } from '../db/client.js';

interface MetricRow {
  metric_key: string;
  aggregation: string;
  external_id: string;
  effective_at: Date;
  value_numeric: string;
  evidence_url: string;
}

export interface EvaluatedMetric {
  value?: number;
  previous?: number;
  evidenceUrl?: string;
}

export async function evaluateMetrics(
  database: Database,
  scope: string,
  version: number,
  windowStart: Date,
  windowEnd: Date,
): Promise<Map<string, EvaluatedMetric>> {
  const rows = await database.query<MetricRow>(
    `SELECT DISTINCT ON (metric_key, external_id, effective_at)
       metric_key, aggregation, external_id, effective_at, value_numeric, evidence_url
     FROM normalized_metric_observations
     WHERE scope = $1 AND metric_version = $2
       AND effective_at < $3 AND created_at <= $3 AND normalized_at <= $3
     ORDER BY metric_key, external_id, effective_at, created_at DESC`,
    [scope, version, windowEnd],
  );
  const definitions = await database.query<{ metric_key: string; aggregation: string }>(
    `SELECT metric_key, aggregation FROM metric_definitions
     WHERE version = $1 ORDER BY metric_key`,
    [version],
  );
  if (definitions.rowCount === 0) {
    throw new Error(`No registered metric definitions for version ${version}`);
  }

  const evaluated = new Map<string, EvaluatedMetric>();
  for (const definition of definitions.rows) {
    const metricRows = rows.rows.filter((row) => row.metric_key === definition.metric_key);
    if (definition.aggregation === 'sum_window') {
      const inWindow = metricRows.filter(
        (row) => row.effective_at >= windowStart && row.effective_at < windowEnd,
      );
      evaluated.set(definition.metric_key, {
        ...(inWindow.length > 0
          ? { value: inWindow.reduce((sum, row) => sum + Number(row.value_numeric), 0) }
          : {}),
        ...(inWindow[0] ? { evidenceUrl: inWindow[0].evidence_url } : {}),
      });
      continue;
    }
    if (definition.aggregation === 'latest') {
      const ordered = [...metricRows].sort(
        (left, right) => right.effective_at.getTime() - left.effective_at.getTime(),
      );
      const current = ordered[0];
      const previous = ordered.find((row) => row.effective_at < windowStart);
      evaluated.set(definition.metric_key, {
        ...(current
          ? { value: Number(current.value_numeric), evidenceUrl: current.evidence_url }
          : {}),
        ...(previous ? { previous: Number(previous.value_numeric) } : {}),
      });
      continue;
    }
    if (definition.aggregation === 'latest_per_release') {
      evaluated.set(definition.metric_key, {});
      continue;
    }
    throw new Error(`Unsupported metric aggregation: ${definition.aggregation}`);
  }
  return evaluated;
}

export async function evaluateLatestPerEntityMetric(
  database: Database,
  scope: string,
  version: number,
  metricKey: string,
  windowEnd: Date,
): Promise<Map<string, EvaluatedMetric>> {
  const definition = await database.query<{ aggregation: string }>(
    `SELECT aggregation FROM metric_definitions WHERE metric_key = $1 AND version = $2`,
    [metricKey, version],
  );
  if (definition.rows[0]?.aggregation !== 'latest_per_release') {
    throw new Error(`Metric ${metricKey} version ${version} is not a latest-per-release metric`);
  }
  const rows = await database.query<MetricRow>(
    `SELECT DISTINCT ON (external_id)
       metric_key, aggregation, external_id, effective_at, value_numeric, evidence_url
     FROM normalized_metric_observations
     WHERE scope = $1 AND metric_version = $2 AND metric_key = $3
       AND effective_at < $4 AND created_at <= $4 AND normalized_at <= $4
     ORDER BY external_id, effective_at DESC, created_at DESC`,
    [scope, version, metricKey, windowEnd],
  );
  return new Map(
    rows.rows.map((row) => [
      row.external_id,
      { value: Number(row.value_numeric), evidenceUrl: row.evidence_url },
    ]),
  );
}
