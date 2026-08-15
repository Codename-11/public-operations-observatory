import { rm } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateWeeklyBriefing } from '../src/briefing/generate.js';
import { addAnnotation } from '../src/db/annotations.js';
import { createDatabase, type Database } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import { ObservationStore } from '../src/db/observation-store.js';
import { applyRetention } from '../src/db/retention.js';
import { dayBucket } from '../src/domain/observation.js';
import { normalizeGitHubObservations } from '../src/normalization/github.js';

const connectionString = process.env.TEST_DATABASE_URL;
const scope = 'test/example';
const outputDirectory = path.resolve('.test-output');

const integration = connectionString ? describe : describe.skip;

integration('PostgreSQL operating loop', () => {
  let database: Database;

  beforeAll(async () => {
    database = createDatabase(connectionString as string);
    await migrate(database);
    await cleanup(database);
  });

  afterAll(async () => {
    await cleanup(database);
    await database.end();
    await rm(outputDirectory, { force: true, recursive: true });
  });

  it('reuses an identical observation and renders an evidence-linked briefing', async () => {
    const store = new ObservationStore(database);
    const firstRun = await store.beginRun('github', scope);
    const input = {
      source: 'github',
      scope,
      recordKind: 'repository.summary',
      externalId: 'repository',
      observedBucket: dayBucket(new Date('2026-08-10T12:00:00Z')),
      schemaVersion: 1,
      payload: { stars: 12, forks: 3 },
      evidenceUrl: 'https://github.com/test/example',
    } as const;
    expect(
      await store.persistBatch(
        firstRun,
        [input],
        {
          key: 'daily-collection',
          observedAt: new Date('2026-08-10T12:00:00Z'),
          cursor: { observedAt: '2026-08-10T12:00:00Z' },
        },
        { status: 'succeeded' },
      ),
    ).toBe(1);

    const secondRun = await store.beginRun('github', scope);
    expect(
      await store.persistBatch(
        secondRun,
        [input],
        {
          key: 'daily-collection',
          observedAt: new Date('2026-08-10T13:00:00Z'),
          cursor: { observedAt: '2026-08-10T13:00:00Z' },
        },
        { status: 'succeeded' },
      ),
    ).toBe(0);

    const changedRun = await store.beginRun('github', scope);
    expect(
      await store.persistBatch(
        changedRun,
        [{ ...input, payload: { stars: 13, forks: 3 } }],
        {
          key: 'daily-collection',
          observedAt: new Date('2026-08-10T14:00:00Z'),
          cursor: { observedAt: '2026-08-10T14:00:00Z' },
        },
        {
          status: 'succeeded',
          sourceMetadata: {
            resources: {
              core: { remaining: 4_321, resetAt: '2026-08-10T15:00:00.000Z' },
            },
          },
        },
      ),
    ).toBe(1);

    const annotation = {
      scope,
      occurredAt: new Date('2026-08-09T10:00:00Z'),
      kind: 'release' as const,
      title: 'Example release',
      evidenceUrl: 'https://github.com/test/example/releases/tag/v1.0.0',
      note: 'Chronology only.',
    };
    const annotationId = await addAnnotation(database, annotation);
    await expect(addAnnotation(database, annotation)).resolves.toBe(annotationId);
    await expect(
      addAnnotation(database, { ...annotation, note: 'Changed later.' }),
    ).rejects.toThrow('Annotation already exists with a different note');
    await expect(
      database.query("UPDATE annotations SET note = 'mutated' WHERE id = $1", [annotationId]),
    ).rejects.toThrow('annotations are append-only');
    await expect(
      database.query('DELETE FROM annotations WHERE id = $1', [annotationId]),
    ).rejects.toThrow('annotations are append-only');
    await addAnnotation(database, {
      scope,
      occurredAt: new Date('2026-08-09T11:00:00Z'),
      kind: 'communication',
      title: '[unsafe](https://invalid.example) <script>',
      evidenceUrl: 'https://example.com/evidence_(safe)',
    });
    await expect(
      addAnnotation(database, {
        ...annotation,
        title: 'Invalid evidence',
        evidenceUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('Annotation evidence URL must use http or https');

    await database.query(
      `INSERT INTO observations
         (source, scope, record_kind, external_id, observed_bucket, schema_version,
          payload, payload_digest, evidence_url, collection_run_id)
       VALUES ('umami', $1, 'repository.summary', 'repository', $2, 1,
         '{"stars":9999}'::jsonb, 'not-a-real-digest', 'https://example.com', $3)`,
      [scope, new Date('2026-08-10T00:00:00Z'), changedRun.id],
    );
    await expect(normalizeGitHubObservations(database, scope)).resolves.toBe(2);
    await database.query(
      `UPDATE collection_runs
       SET started_at = checkpoint.cursor_at,
           finished_at = checkpoint.cursor_at
       FROM source_checkpoint_history checkpoint
       WHERE collection_runs.id = checkpoint.collection_run_id
         AND collection_runs.scope = $1`,
      [scope],
    );
    await database.query(
      `UPDATE observations
       SET created_at = observed_bucket + interval '12 hours'
       WHERE scope = $1`,
      [scope],
    );
    await database.query(
      `UPDATE normalized_records
       SET source_created_at = effective_at + interval '12 hours'
           + CASE WHEN payload ->> 'stars' = '13' THEN interval '2 hours' ELSE interval '0 hours' END,
           normalized_at = effective_at + interval '12 hours'
           + CASE WHEN payload ->> 'stars' = '13' THEN interval '2 hours' ELSE interval '0 hours' END
       WHERE scope = $1`,
      [scope],
    );
    await database.query(
      `UPDATE source_checkpoint_history
       SET recorded_at = cursor_at
       WHERE scope = $1`,
      [scope],
    );
    await database.query(
      `INSERT INTO annotations
         (scope, occurred_at, kind, title, evidence_url, created_at)
       VALUES
         ($1, '2026-08-09T10:00:00Z', 'release', 'Historical release',
          'https://github.com/test/example/releases/tag/v1.0.0', '2026-08-09T10:00:00Z'),
         ($1, '2026-08-09T11:00:00Z', 'communication',
          '[historical unsafe](https://invalid.example) <script>',
          'https://example.com/evidence_(safe)', '2026-08-09T11:00:00Z')`,
      [scope],
    );
    const briefingOptions = {
      scope,
      windowStart: new Date('2026-08-04T00:00:00Z'),
      windowEnd: new Date('2026-08-12T00:00:00Z'),
      outputDirectory,
      freshnessHours: 30,
    };
    const result = await generateWeeklyBriefing(database, briefingOptions);
    expect(result.markdown).toContain('| GitHub stars | 13 |');
    expect(result.markdown).toContain('Last successful checkpoint: 2026-08-10T14:00:00.000Z.');
    expect(result.markdown).toContain('GitHub API core rate limit: 4,321 requests remaining');
    expect(result.markdown).toContain('[source](<https://github.com/test/example>)');
    expect(result.markdown).toContain(
      '[Historical release](<https://github.com/test/example/releases/tag/v1.0.0>)',
    );
    expect(result.markdown).toContain(
      '[\\[historical unsafe\\]\\(https://invalid.example\\) &lt;script&gt;](<https://example.com/evidence_(safe)>)',
    );
    expect(result.markdown).not.toContain('9,999');
    const normalized = await database.query<{ metric_key: string; value_numeric: string }>(
      `SELECT metric_key, value_numeric::text
       FROM normalized_metric_observations
       WHERE scope = $1 AND metric_key = 'github.stars'
       ORDER BY created_at DESC LIMIT 1`,
      [scope],
    );
    expect(normalized.rows[0]).toEqual({ metric_key: 'github.stars', value_numeric: '13' });

    const lateCheckpointRun = await database.query<{ id: string }>(
      `INSERT INTO collection_runs
         (source, scope, status, started_at, finished_at, error_summary)
       VALUES ('github', $1, 'succeeded', $2, $2, NULL)
       RETURNING id`,
      [scope, new Date('2026-08-10T13:30:00Z')],
    );
    await database.query(
      `INSERT INTO source_checkpoint_history
         (source, scope, checkpoint_key, cursor, cursor_at, collection_run_id, recorded_at)
       VALUES ('github', $1, 'daily-collection', '{}'::jsonb, $2, $3, $4)`,
      [
        scope,
        new Date('2026-08-11T00:00:00Z'),
        lateCheckpointRun.rows[0]?.id,
        new Date('2026-08-13T00:00:00Z'),
      ],
    );
    await database.query(
      `INSERT INTO observations
         (source, scope, record_kind, external_id, observed_bucket, schema_version,
          payload, payload_digest, evidence_url, collection_run_id, created_at)
       VALUES ('github', $1, 'repository.summary', 'repository', $2, 1,
         '{"stars":14,"forks":3}'::jsonb, 'late-backfill',
         'https://github.com/test/example', $3, $4)`,
      [
        scope,
        dayBucket(new Date('2026-08-10T12:00:00Z')),
        changedRun.id,
        new Date('2026-08-13T00:00:00Z'),
      ],
    );
    await expect(normalizeGitHubObservations(database, scope)).resolves.toBe(1);
    await database.query(
      `INSERT INTO annotations
         (scope, occurred_at, kind, title, evidence_url, created_at)
       VALUES ($1, $2, 'communication', 'Late backdated annotation',
         'https://example.com/late', $3)`,
      [scope, new Date('2026-08-09T12:00:00Z'), new Date('2026-08-13T00:00:00Z')],
    );
    const regenerated = await generateWeeklyBriefing(database, briefingOptions);
    expect(regenerated.digest).toBe(result.digest);
    await expect(
      generateWeeklyBriefing(database, { ...briefingOptions, metricVersion: 2 }),
    ).rejects.toThrow('Unsupported metric definition version: 2');

    const counts = await database.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM observations WHERE source = 'github' AND scope = $1",
      [scope],
    );
    expect(counts.rows[0]?.count).toBe('3');
  });

  it('prevents checkpoint regression and rejects scope mismatch', async () => {
    const store = new ObservationStore(database);
    const newerRun = await store.beginRun('github', scope);
    await store.persistBatch(
      newerRun,
      [],
      {
        key: 'overlap',
        observedAt: new Date('2026-08-11T12:00:00Z'),
        cursor: { observedAt: '2026-08-11T12:00:00Z' },
      },
      { status: 'succeeded' },
    );
    await store.finishRun(newerRun.id, 'failed', {}, 'uncertain commit');
    const completedRun = await database.query<{ status: string }>(
      'SELECT status FROM collection_runs WHERE id = $1',
      [newerRun.id],
    );
    expect(completedRun.rows[0]?.status).toBe('succeeded');
    await expect(
      database.query("UPDATE collection_runs SET status = 'failed' WHERE id = $1", [newerRun.id]),
    ).rejects.toThrow('a collection run referenced by a checkpoint must remain succeeded');
    const olderRun = await store.beginRun('github', scope);
    await store.persistBatch(
      olderRun,
      [],
      {
        key: 'overlap',
        observedAt: new Date('2026-08-11T10:00:00Z'),
        cursor: { observedAt: '2026-08-11T10:00:00Z' },
      },
      { status: 'succeeded' },
    );
    const checkpoint = await database.query<{ cursor_at: Date }>(
      "SELECT cursor_at FROM source_checkpoints WHERE source = 'github' AND scope = $1 AND checkpoint_key = 'overlap'",
      [scope],
    );
    expect(checkpoint.rows[0]?.cursor_at.toISOString()).toBe('2026-08-11T12:00:00.000Z');

    const mismatchRun = await store.beginRun('github', scope);
    await expect(
      store.persistBatch(
        mismatchRun,
        [
          {
            source: 'github',
            scope: 'wrong/scope',
            recordKind: 'repository.summary',
            externalId: 'repository',
            observedBucket: new Date('2026-08-11T00:00:00Z'),
            schemaVersion: 1,
            payload: { stars: 1 },
            evidenceUrl: 'https://github.com/wrong/scope',
          },
        ],
        {
          key: 'daily',
          observedAt: new Date('2026-08-11T00:00:00Z'),
          cursor: { observedAt: '2026-08-11T00:00:00Z' },
        },
        { status: 'succeeded' },
      ),
    ).rejects.toThrow('Observation source and scope must match its collection run');
    await store.finishRun(mismatchRun.id, 'failed');

    const partialRun = await store.beginRun('github', scope);
    await expect(
      store.persistBatch(
        partialRun,
        [],
        {
          key: 'daily',
          observedAt: new Date('2026-08-11T00:00:00Z'),
          cursor: { observedAt: '2026-08-11T00:00:00Z' },
        },
        { status: 'partial' },
      ),
    ).rejects.toThrow('Only a succeeded collection run may advance a checkpoint');
    await store.finishRun(partialRun.id, 'partial');
    await expect(
      database.query(
        `INSERT INTO source_checkpoint_history
           (source, scope, checkpoint_key, cursor, cursor_at, collection_run_id)
         VALUES ('github', $1, 'invalid', '{}'::jsonb, $2, $3)`,
        [scope, new Date('2026-08-11T00:00:00Z'), partialRun.id],
      ),
    ).rejects.toThrow('checkpoint collection run must be succeeded');
  });

  it('enforces raw and diagnostic retention with an audit record', async () => {
    const oldRun = await database.query<{ id: string }>(
      `INSERT INTO collection_runs
         (source, scope, status, started_at, finished_at, error_summary, source_metadata)
       VALUES ('github', $1, 'failed', $2, $2, 'old error', '{"remaining":1}'::jsonb)
       RETURNING id`,
      [scope, new Date('2026-06-01T00:00:00Z')],
    );
    await database.query(
      `INSERT INTO observations
         (source, scope, record_kind, external_id, observed_bucket, schema_version,
          payload, payload_digest, evidence_url, collection_run_id, created_at)
       VALUES ('github', $1, 'repository.summary', 'repository', $2, 1,
         '{"stars":1}'::jsonb, 'expired-raw', 'https://github.com/test/example', $3, $2)`,
      [scope, new Date('2026-05-01T00:00:00Z'), oldRun.rows[0]?.id],
    );
    await expect(normalizeGitHubObservations(database, scope)).resolves.toBe(1);
    await database.query(
      `INSERT INTO observations
         (source, scope, record_kind, external_id, observed_bucket, schema_version,
          payload, payload_digest, evidence_url, collection_run_id, created_at)
       VALUES ('github', $1, 'unsupported.summary', 'unsupported', $2, 99,
         '{}'::jsonb, 'expired-unsupported', 'https://github.com/test/example', $3, $2)`,
      [scope, new Date('2026-05-02T00:00:00Z'), oldRun.rows[0]?.id],
    );
    const result = await applyRetention(database, new Date('2026-08-11T00:00:00Z'));
    expect(result.diagnosticsRedacted).toBeGreaterThan(0);
    expect(result.rawObservationsDeleted).toBe(2);
    expect(result.unnormalizedRawObservationsDeleted).toBe(1);
    expect(result.rawObservationsOverdue).toBe(0);
    const retained = await database.query<{
      error_summary: string | null;
      source_metadata: object;
    }>(
      `SELECT error_summary, source_metadata FROM collection_runs
       WHERE scope = $1 AND started_at = $2`,
      [scope, new Date('2026-06-01T00:00:00Z')],
    );
    expect(retained.rows[0]).toEqual({ error_summary: null, source_metadata: {} });
    const durable = await database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM normalized_records
       WHERE scope = $1 AND source_created_at = $2`,
      [scope, new Date('2026-05-01T00:00:00Z')],
    );
    expect(durable.rows[0]?.count).toBe('1');
  });

  it('serializes checkpoint insertion against concurrent run demotion', async () => {
    const store = new ObservationStore(database);
    const run = await store.beginRun('github', scope);
    await store.persistBatch(run, [], undefined, { status: 'succeeded' });
    const checkpointer = await database.connect();
    const demoter = await database.connect();
    try {
      await checkpointer.query('BEGIN');
      await demoter.query('BEGIN');
      await checkpointer.query(
        `INSERT INTO source_checkpoint_history
           (source, scope, checkpoint_key, cursor, cursor_at, collection_run_id)
         VALUES ('github', $1, 'race', '{}'::jsonb, $2, $3)`,
        [scope, new Date('2026-08-11T00:00:00Z'), run.id],
      );
      const demotion = demoter.query("UPDATE collection_runs SET status = 'failed' WHERE id = $1", [
        run.id,
      ]);
      const demotionRejected = expect(demotion).rejects.toThrow(
        'a collection run referenced by a checkpoint must remain succeeded',
      );
      await checkpointer.query('COMMIT');
      await demotionRejected;
      await demoter.query('ROLLBACK');
      const invariant = await database.query<{ refs: string; status: string }>(
        `SELECT run.status,
           count(history.collection_run_id)::text AS refs
         FROM collection_runs run
         LEFT JOIN source_checkpoint_history history ON history.collection_run_id = run.id
         WHERE run.id = $1
         GROUP BY run.status`,
        [run.id],
      );
      expect(invariant.rows[0]).toEqual({ refs: '1', status: 'succeeded' });
    } finally {
      await checkpointer.query('ROLLBACK').catch(() => undefined);
      await demoter.query('ROLLBACK').catch(() => undefined);
      checkpointer.release();
      demoter.release();
    }
  });

  it('serializes concurrent migration attempts', async () => {
    const [left, right] = await Promise.all([migrate(database), migrate(database)]);
    expect(left).toEqual([]);
    expect(right).toEqual([]);
  });

  it('rejects overlapping collectors for the same source and scope', async () => {
    const store = new ObservationStore(database);
    await store.withCollectionLock('github', scope, async () => {
      await expect(
        store.withCollectionLock('github', scope, () => Promise.resolve()),
      ).rejects.toThrow(`A collection is already running for github:${scope}`);
    });
  });
});

async function cleanup(database: Database): Promise<void> {
  await database.query('DELETE FROM briefing_revisions WHERE scope = $1', [scope]);
  await database.query('TRUNCATE annotations');
  await database.query('DELETE FROM source_checkpoint_history WHERE scope = $1', [scope]);
  await database.query('DELETE FROM source_checkpoints WHERE scope = $1', [scope]);
  await database.query('DELETE FROM normalized_records WHERE scope = $1', [scope]);
  await database.query('DELETE FROM observations WHERE scope = $1', [scope]);
  await database.query('DELETE FROM collection_runs WHERE scope = $1', [scope]);
}
