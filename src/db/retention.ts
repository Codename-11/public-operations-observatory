import type { Database } from './client.js';

export interface RetentionResult {
  auditId: string;
  cutoffAt: string;
  diagnosticsRedacted: number;
}

export async function applyRetention(
  database: Database,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const redacted = await client.query(
      `UPDATE collection_runs
       SET error_summary = NULL, source_metadata = '{}'::jsonb
       WHERE finished_at < $1
         AND (error_summary IS NOT NULL OR source_metadata <> '{}'::jsonb)`,
      [cutoff],
    );
    const audit = await client.query<{ id: string }>(
      `INSERT INTO retention_runs (policy_version, cutoff_at, diagnostics_redacted)
       VALUES (1, $1, $2)
       RETURNING id`,
      [cutoff, redacted.rowCount ?? 0],
    );
    await client.query('COMMIT');
    const row = audit.rows[0];
    if (!row) throw new Error('Failed to record retention audit');
    return {
      auditId: row.id,
      cutoffAt: cutoff.toISOString(),
      diagnosticsRedacted: redacted.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
