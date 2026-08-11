import type { Database } from './client.js';

export interface RetentionResult {
  auditId: string;
  cutoffAt: string;
  diagnosticsRedacted: number;
  rawCutoffAt: string;
  rawObservationsDeleted: number;
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
    const deleted = await client.query(
      `DELETE FROM observations observation
       WHERE observation.source = 'github' AND observation.created_at < $1
         AND EXISTS (
           SELECT 1 FROM normalized_records normalized
           WHERE normalized.source_observation_id = observation.id
         )`,
      [rawCutoff],
    );
    const audit = await client.query<{ id: string }>(
      `INSERT INTO retention_runs
         (policy_version, cutoff_at, raw_cutoff_at, diagnostics_redacted, raw_observations_deleted)
       VALUES (2, $1, $2, $3, $4)
       RETURNING id`,
      [diagnosticsCutoff, rawCutoff, redacted.rowCount ?? 0, deleted.rowCount ?? 0],
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
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
