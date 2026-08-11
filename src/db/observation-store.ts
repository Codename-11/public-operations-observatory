import type { PoolClient } from 'pg';

import { digestPayload, type ObservationInput } from '../domain/observation.js';
import type { Database } from './client.js';

export type RunStatus = 'failed' | 'partial' | 'running' | 'succeeded';

export interface CollectionRun {
  id: string;
  source: string;
  scope: string;
}

export interface CheckpointInput {
  key: string;
  observedAt: Date;
  cursor: Record<string, unknown>;
}

export interface RunCompletion {
  status: 'partial' | 'succeeded';
  sourceMetadata?: Record<string, unknown>;
  errorSummary?: string;
}

export class ObservationStore {
  public constructor(private readonly database: Database) {}

  public async beginRun(source: string, scope: string): Promise<CollectionRun> {
    const result = await this.database.query<CollectionRun>(
      `INSERT INTO collection_runs (source, scope, status)
       VALUES ($1, $2, 'running')
       RETURNING id, source, scope`,
      [source, scope],
    );
    const run = result.rows[0];
    if (!run) throw new Error('Failed to create collection run');
    return run;
  }

  public async persistBatch(
    run: CollectionRun,
    observations: ObservationInput[],
    checkpoint: CheckpointInput,
    completion: RunCompletion,
  ): Promise<number> {
    for (const observation of observations) {
      if (observation.source !== run.source || observation.scope !== run.scope) {
        throw new Error('Observation source and scope must match its collection run');
      }
    }
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      let inserted = 0;
      for (const observation of observations) {
        inserted += await this.insertObservation(client, run.id, observation);
      }
      await client.query(
        `INSERT INTO source_checkpoints
           (source, scope, checkpoint_key, cursor, cursor_at, collection_run_id)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)
         ON CONFLICT (source, scope, checkpoint_key) DO UPDATE
         SET cursor = EXCLUDED.cursor,
             cursor_at = EXCLUDED.cursor_at,
             collection_run_id = EXCLUDED.collection_run_id,
             advanced_at = now()
         WHERE source_checkpoints.cursor_at <= EXCLUDED.cursor_at`,
        [
          run.source,
          run.scope,
          checkpoint.key,
          JSON.stringify(checkpoint.cursor),
          checkpoint.observedAt,
          run.id,
        ],
      );
      const completed = await client.query(
        `UPDATE collection_runs
         SET status = $2, finished_at = now(), source_metadata = $3::jsonb, error_summary = $4
         WHERE id = $1 AND status = 'running'`,
        [
          run.id,
          completion.status,
          JSON.stringify(completion.sourceMetadata ?? {}),
          completion.errorSummary ?? null,
        ],
      );
      if (completed.rowCount !== 1) throw new Error('Collection run was not in running state');
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async finishRun(
    runId: string,
    status: Exclude<RunStatus, 'running'>,
    sourceMetadata: Record<string, unknown> = {},
    errorSummary?: string,
  ): Promise<void> {
    await this.database.query(
      `UPDATE collection_runs
       SET status = $2, finished_at = now(), source_metadata = $3::jsonb, error_summary = $4
       WHERE id = $1`,
      [runId, status, JSON.stringify(sourceMetadata), errorSummary ?? null],
    );
  }

  private async insertObservation(
    client: PoolClient,
    runId: string,
    observation: ObservationInput,
  ): Promise<number> {
    const result = await client.query(
      `INSERT INTO observations
         (source, scope, record_kind, external_id, observed_bucket, schema_version,
          payload, payload_digest, evidence_url, collection_run_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
       ON CONFLICT DO NOTHING`,
      [
        observation.source,
        observation.scope,
        observation.recordKind,
        observation.externalId,
        observation.observedBucket,
        observation.schemaVersion,
        JSON.stringify(observation.payload),
        digestPayload(observation.payload),
        observation.evidenceUrl,
        runId,
      ],
    );
    return result.rowCount ?? 0;
  }
}
