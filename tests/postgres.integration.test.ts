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
        { status: 'succeeded' },
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
    await addAnnotation(database, {
      scope,
      occurredAt: new Date('2026-08-09T11:00:00Z'),
      kind: 'communication',
      title: '[unsafe](https://invalid.example) <script>',
      evidenceUrl: 'https://example.com/evidence',
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

    const briefingOptions = {
      scope,
      windowStart: new Date('2026-08-04T00:00:00Z'),
      windowEnd: new Date('2026-08-12T00:00:00Z'),
      outputDirectory,
      freshnessHours: 30,
    };
    const result = await generateWeeklyBriefing(database, briefingOptions);
    expect(result.markdown).toContain('| GitHub stars | 13 |');
    expect(result.markdown).toContain('[source](https://github.com/test/example)');
    expect(result.markdown).toContain(
      '[Example release](https://github.com/test/example/releases/tag/v1.0.0)',
    );
    expect(result.markdown).toContain(
      '[\\[unsafe\\]\\(https://invalid.example\\) &lt;script&gt;](https://example.com/evidence)',
    );
    expect(result.markdown).not.toContain('9,999');

    await database.query(
      `INSERT INTO collection_runs
         (source, scope, status, started_at, finished_at, error_summary)
       VALUES ('github', $1, 'partial', $2, $2, 'future diagnostic')`,
      [scope, new Date('2026-08-13T00:00:00Z')],
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
    expect(counts.rows[0]?.count).toBe('2');
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
  });

  it('redacts expired diagnostics and records an auditable retention run', async () => {
    await database.query(
      `INSERT INTO collection_runs
         (source, scope, status, started_at, finished_at, error_summary, source_metadata)
       VALUES ('github', $1, 'failed', $2, $2, 'old error', '{"remaining":1}'::jsonb)`,
      [scope, new Date('2026-06-01T00:00:00Z')],
    );
    const result = await applyRetention(database, new Date('2026-08-11T00:00:00Z'));
    expect(result.diagnosticsRedacted).toBeGreaterThan(0);
    const retained = await database.query<{
      error_summary: string | null;
      source_metadata: object;
    }>(
      `SELECT error_summary, source_metadata FROM collection_runs
       WHERE scope = $1 AND started_at = $2`,
      [scope, new Date('2026-06-01T00:00:00Z')],
    );
    expect(retained.rows[0]).toEqual({ error_summary: null, source_metadata: {} });
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
  await database.query('DELETE FROM annotations WHERE scope = $1', [scope]);
  await database.query('DELETE FROM source_checkpoints WHERE scope = $1', [scope]);
  await database.query('DELETE FROM observations WHERE scope = $1', [scope]);
  await database.query('DELETE FROM collection_runs WHERE scope = $1', [scope]);
}
