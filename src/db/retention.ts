import type { Database } from './client.js';

export interface RetentionResult {
  auditId: string;
  cutoffAt: string;
  diagnosticsRedacted: number;
  rawCutoffAt: string;
  rawObservationsDeleted: number;
  rawObservationsOverdue: number;
  unnormalizedRawObservationsDeleted: number;
}

export async function applyRetention(
  database: Database,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const diagnosticsCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const rawCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const redacted = await client.query(
      `UPDATE collection_runs
       SET error_summary = NULL, source_metadata = '{}'::jsonb
       WHERE finished_at < $1
         AND (error_summary IS NOT NULL OR source_metadata <> '{}'::jsonb)`,
      [diagnosticsCutoff],
    );
    const deleted = await client.query<{ normalized: boolean }>(
      `WITH expired AS (
         SELECT observation.id,
           EXISTS (
             SELECT 1 FROM normalized_records normalized
             WHERE normalized.source_observation_id = observation.id
           ) AS normalized
         FROM observations observation
         WHERE observation.source = 'github' AND observation.created_at < $1
       ), deleted AS (
         DELETE FROM observations observation
         USING expired
         WHERE observation.id = expired.id
         RETURNING expired.normalized
       )
       SELECT normalized FROM deleted`,
      [rawCutoff],
    );
    const unnormalizedDeleted = deleted.rows.filter((row) => !row.normalized).length;
    const overdue = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM observations
       WHERE source = 'github' AND created_at < $1`,
      [rawCutoff],
    );
    const overdueCount = Number(overdue.rows[0]?.count ?? 0);
    const audit = await client.query<{ id: string }>(
      `INSERT INTO retention_runs
         (policy_version, cutoff_at, raw_cutoff_at, diagnostics_redacted,
          raw_observations_deleted, unnormalized_raw_observations_deleted,
          raw_observations_overdue)
       VALUES (3, $1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        diagnosticsCutoff,
        rawCutoff,
        redacted.rowCount ?? 0,
        deleted.rowCount ?? 0,
        unnormalizedDeleted,
        overdueCount,
      ],
    );
    await client.query('COMMIT');
    const row = audit.rows[0];
    if (!row) throw new Error('Failed to record retention audit');
    return {
      auditId: row.id,
      cutoffAt: diagnosticsCutoff.toISOString(),
      diagnosticsRedacted: redacted.rowCount ?? 0,
      rawCutoffAt: rawCutoff.toISOString(),
      rawObservationsDeleted: deleted.rowCount ?? 0,
      rawObservationsOverdue: overdueCount,
      unnormalizedRawObservationsDeleted: unnormalizedDeleted,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
