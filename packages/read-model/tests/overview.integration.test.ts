import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { migrate } from '../../../src/db/migrate.js';
import { readHistoricalContext } from '../src/history.js';
import { readOverview } from '../src/overview.js';
import { getProject } from '../src/project-registry.js';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;
const scope = 'Codename-11/hermes-relay';
const asOf = '2026-08-18T12:00:00.000Z';
const windowEnd = '2026-08-17T00:00:00.000Z';
const repositoryUrl = 'https://github.com/Codename-11/hermes-relay';

integration('PostgreSQL Overview read model', () => {
  let admin: pg.Pool;
  let database: pg.Pool;
  const databaseName = `observatory_read_model_${process.pid}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: connectionString as string });
    await admin.query(`CREATE DATABASE ${databaseName}`);
    const isolatedUrl = new URL(connectionString as string);
    isolatedUrl.pathname = `/${databaseName}`;
    database = new Pool({ connectionString: isolatedUrl.toString() });
    await migrate(database);
  });

  beforeEach(async () => cleanup(database));

  afterAll(async () => {
    await cleanup(database);
    database.on('error', () => undefined);
    await database.end().catch(() => undefined);
    await admin
      .query(
        `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
          WHERE datname = $1
            AND pid <> pg_backend_pid()`,
        [databaseName],
      )
      .catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await admin.end();
  });

  it('uses canonical completed weeks and assembles complete current/prior metrics with evidence', async () => {
    await seedComplete(database);

    const overview = await readOverview(database, {
      projectKey: 'hermes-relay',
      period: '7d',
      asOf,
    });

    expect(overview.window).toEqual({
      comparisonStart: '2026-08-03T00:00:00.000Z',
      comparisonEnd: '2026-08-10T00:00:00.000Z',
      start: '2026-08-10T00:00:00.000Z',
      end: windowEnd,
    });
    expect(overview.availability).toBe('complete');
    expect(change(overview, 'github.stars')).toMatchObject({
      current: 125,
      previous: 110,
      delta: 15,
    });
    expect(change(overview, 'github.views')).toMatchObject({
      current: 91,
      previous: 42,
      delta: 49,
    });
    expect(change(overview, 'github.clones')).toMatchObject({
      current: 21,
      previous: 14,
      delta: 7,
    });
    expect(change(overview, 'github.release_asset_downloads')).toMatchObject({
      current: 6,
      previous: 4,
      delta: 2,
    });
    expect(change(overview, 'github.open_issues')).toMatchObject({
      current: 7,
      previous: 5,
      delta: 2,
    });
    expect(overview.release).toMatchObject({ tagName: 'v1.0.0', assetDownloads: 2 });
    expect(overview.briefing).toMatchObject({
      availability: 'complete',
      summary: 'Deterministic weekly summary.',
    });
    expect(overview.trend).toMatchObject({
      metricKey: 'github.release_asset_downloads',
      label: 'Release asset downloads',
      unit: 'downloads',
      availability: 'complete',
    });
    expect(overview.trend.points.map(({ timestamp, value }) => ({ timestamp, value }))).toEqual([
      { timestamp: '2026-08-12T00:00:00.000Z', value: 4 },
      { timestamp: '2026-08-14T00:00:00.000Z', value: 2 },
    ]);
    expect(overview.trend.points.some((point) => point.value === 112 || point.value === 125)).toBe(
      false,
    );
    expect(overview.provenance.references.length).toBeGreaterThan(0);
    expect(JSON.stringify(overview)).not.toContain('diagnostic secret');
    expect(JSON.stringify(overview)).not.toContain('visitor');
  });

  it('uses latest persisted evidence for the current UTC-day window with honest coverage', async () => {
    await seedComplete(database);

    const overview = await readOverview(database, {
      projectKey: 'hermes-relay',
      period: '7d',
      view: 'current',
      asOf,
    });

    expect(overview.view).toBe('current');
    expect(overview.window).toEqual({
      comparisonStart: '2026-08-05T00:00:00.000Z',
      comparisonEnd: '2026-08-12T00:00:00.000Z',
      start: '2026-08-12T00:00:00.000Z',
      end: '2026-08-19T00:00:00.000Z',
    });
    expect(change(overview, 'github.stars')).toMatchObject({
      availability: 'partial',
      current: 125,
      previous: 113,
      delta: 12,
    });
    expect(change(overview, 'github.views')).toMatchObject({
      availability: 'partial',
      current: 70,
      previous: 51,
      delta: null,
      coverage: {
        currentObservedDays: 5,
        previousObservedDays: 7,
        requiredDays: 7,
      },
    });
  });

  it('withholds exact star deltas when the prior value is a lower-bound reconstruction', async () => {
    await seedComplete(database);
    await database.query(
      `DELETE FROM normalized_records
        WHERE (record_kind = 'repository.summary' AND effective_at >= '2026-08-09' AND effective_at < '2026-08-12')
           OR (record_kind = 'issues.summary' AND effective_at < '2026-08-12')`,
    );
    await record(database, {
      id: id(901),
      kind: 'repository.summary',
      externalId: 'repository-history',
      effectiveAt: '2026-08-11T00:00:00Z',
      payload: {
        stars: 109,
        derivation: { method: 'current-stargazer-cohort', lowerBound: true },
      },
    });
    await record(database, {
      id: id(902),
      kind: 'issues.summary',
      externalId: 'issues-history',
      effectiveAt: '2026-08-11T00:00:00Z',
      payload: {
        open: 14,
        derivation: { method: 'issue-state-events', reconstructed: true },
      },
    });

    const overview = await readOverview(database, {
      projectKey: 'hermes-relay',
      period: '7d',
      view: 'current',
      asOf,
    });
    expect(change(overview, 'github.stars')).toMatchObject({
      current: 125,
      previous: 109,
      delta: null,
    });
    expect(change(overview, 'github.open_issues')).toMatchObject({
      current: 7,
      previous: 14,
      delta: -7,
    });
    expect(overview.provenance.references.map(({ ref }) => ref)).toEqual(
      expect.arrayContaining([`record:${id(901)}`, `record:${id(902)}`]),
    );
  });

  it('returns independent month-end reconstructed history and observed traffic days', async () => {
    await seedComplete(database);
    await record(database, {
      id: id(903),
      kind: 'repository.summary',
      externalId: 'repository-history',
      effectiveAt: '2026-04-09T00:00:00Z',
      payload: { stars: 1, derivation: { method: 'current-stargazer-cohort', lowerBound: true } },
    });
    await record(database, {
      id: id(904),
      kind: 'repository.summary',
      externalId: 'repository-history',
      effectiveAt: '2026-04-30T00:00:00Z',
      payload: { stars: 12, derivation: { method: 'current-stargazer-cohort', lowerBound: true } },
    });
    await record(database, {
      id: id(905),
      kind: 'issues.summary',
      externalId: 'issues-history',
      effectiveAt: '2026-04-30T00:00:00Z',
      payload: { open: 4, derivation: { method: 'issue-state-events', reconstructed: true } },
    });

    const history = await readHistoricalContext(database, {
      projectKey: 'hermes-relay',
      period: '180d',
      asOf,
    });
    const stars = history.series.find(({ metricKey }) => metricKey === 'github.stars');
    const issues = history.series.find(({ metricKey }) => metricKey === 'github.open_issues');
    const views = history.series.find(({ metricKey }) => metricKey === 'github.views');
    expect(stars).toMatchObject({ method: 'lower-bound', bucket: 'calendar-month-end' });
    expect(stars?.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ timestamp: '2026-04-30T00:00:00.000Z', value: 12 }),
      ]),
    );
    expect(stars?.points.some(({ timestamp }) => timestamp === '2026-04-09T00:00:00.000Z')).toBe(
      false,
    );
    expect(issues?.points).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 4, availability: 'partial' })]),
    );
    expect(views).toMatchObject({ method: 'observed', bucket: 'utc-day', availability: 'partial' });
    expect(history.provenance.references.map(({ ref }) => ref)).toContain(`record:${id(904)}`);
  });

  it('does not treat history backfills as source-refresh freshness', async () => {
    await seedComplete(database);
    const backfillRun = '20000000-0000-4000-8000-000000000099';
    await seedRun(database, backfillRun, 'succeeded', '2026-08-18T11:00:00Z');
    await database.query(
      `UPDATE collection_runs SET operation = 'history_backfill' WHERE id = $1`,
      [backfillRun],
    );

    const overview = await readOverview(database, {
      projectKey: 'hermes-relay',
      period: '7d',
      view: 'current',
      asOf,
    });
    expect(overview.freshness.lastSuccessfulAt).toBe('2026-08-18T01:00:00.000Z');
    expect(overview.sources[0]?.lastAttemptAt).toBe('2026-08-18T01:00:00.000Z');
  });

  it('does not treat an older release first observed in the current window as interval downloads', async () => {
    await seedRun(
      database,
      '20000000-0000-4000-8000-000000000099',
      'succeeded',
      '2026-08-18T01:00:00Z',
    );
    await record(database, {
      id: id(999),
      kind: 'release.summary',
      externalId: 'old-release',
      effectiveAt: '2026-08-16T00:00:00Z',
      payload: release(250, 'v0.9.0', '2026-08-01T12:00:00.000Z'),
    });

    const overview = await readOverview(database, {
      projectKey: 'hermes-relay',
      period: '7d',
      view: 'current',
      asOf,
    });

    expect(change(overview, 'github.release_asset_downloads')).toMatchObject({
      current: null,
      previous: null,
      delta: null,
    });
  });

  it('retains honest partial and stale values while suppressing unsupported deltas', async () => {
    await seedRun(
      database,
      '20000000-0000-4000-8000-000000000001',
      'partial',
      '2026-08-17T01:00:00Z',
    );
    await record(database, {
      id: '30000000-0000-4000-8000-000000000001',
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-16T00:00:00Z',
      payload: { stars: 9 },
    });

    const partial = await readOverview(database, request());
    expect(partial.availability).toBe('partial');
    expect(partial.warnings.map((warning) => warning.code)).toEqual([
      'partial_run',
      'missing_successful_checkpoint',
      'incomplete_metric_window',
      'incomplete_metric_window',
      'incomplete_metric_window',
      'incomplete_metric_window',
      'incomplete_metric_window',
    ]);
    expect(change(partial, 'github.stars')).toMatchObject({
      availability: 'partial',
      current: 9,
      previous: null,
      delta: null,
    });
    expect(partial.attention.every((item) => item.sourceKey === 'github')).toBe(true);

    await cleanup(database);
    await seedComplete(database, '2026-08-10T00:00:00Z');
    const stale = await readOverview(database, request());
    expect(stale.availability).toBe('stale');
    expect(stale.freshness.staleAfter).toBe('2026-08-11T06:00:00.000Z');
    expect(stale.warnings[0]?.code).toBe('stale_collection');
    expect(change(stale, 'github.stars').availability).toBe('stale');
  });

  it('keeps an explicit historical as-of invariant under late backfill', async () => {
    await seedComplete(database);
    const before = await readOverview(database, request());

    await record(database, {
      id: '30000000-0000-4000-8000-000000000099',
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-16T00:00:00Z',
      sourceCreatedAt: '2026-08-19T00:00:00Z',
      normalizedAt: '2026-08-19T00:00:00Z',
      payload: { stars: 999999 },
    });
    await database.query(
      `INSERT INTO annotations
         (id, scope, occurred_at, kind, title, evidence_url, created_at)
       VALUES ($1, $2, $3, 'communication', 'Late backfill', $4, $5)`,
      [
        '50000000-0000-4000-8000-000000000099',
        scope,
        '2026-08-11T00:00:00Z',
        `${repositoryUrl}/discussions/1`,
        '2026-08-19T00:00:00Z',
      ],
    );

    await expect(readOverview(database, request())).resolves.toEqual(before);
  });

  it('does not rewrite a completed metric window with a backfill before asOf but after windowEnd', async () => {
    await seedComplete(database);
    const before = await readOverview(database, request());

    await record(database, {
      id: '30000000-0000-4000-8000-000000000098',
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-16T00:00:00Z',
      sourceCreatedAt: '2026-08-18T01:00:00Z',
      normalizedAt: '2026-08-18T01:00:00Z',
      payload: { stars: 888888 },
    });

    await expect(readOverview(database, request())).resolves.toEqual(before);
  });

  it('calculates release intervals across a cumulative counter reset', async () => {
    await seedComplete(database);
    const overview = await readOverview(database, request());

    expect(change(overview, 'github.release_asset_downloads')).toMatchObject({
      availability: 'complete',
      current: 6,
      previous: 4,
    });
  });

  it('counts newly published releases from zero and handles multiple per-release resets', async () => {
    await seedComplete(database);
    await record(database, {
      id: id(12),
      kind: 'release.summary',
      externalId: 'release-2',
      effectiveAt: '2026-08-11T00:00:00Z',
      payload: release(3, 'v2.0.0', '2026-08-11T00:00:00.000Z'),
    });
    await record(database, {
      id: id(13),
      kind: 'release.summary',
      externalId: 'release-2',
      effectiveAt: '2026-08-13T00:00:00Z',
      payload: release(1, 'v2.0.0', '2026-08-11T00:00:00.000Z'),
    });
    await record(database, {
      id: id(14),
      kind: 'release.summary',
      externalId: 'release-3',
      effectiveAt: '2026-08-15T00:00:00Z',
      payload: release(4, 'v3.0.0', '2026-08-15T00:00:00.000Z'),
    });

    const overview = await readOverview(database, request());
    expect(change(overview, 'github.release_asset_downloads')).toMatchObject({
      availability: 'complete',
      current: 14,
      previous: 4,
      delta: 10,
    });
    expect(change(overview, 'github.release_asset_downloads').provenanceRefs).toHaveLength(7);
    expect(overview.trend.points.map(({ timestamp, value }) => ({ timestamp, value }))).toEqual([
      { timestamp: '2026-08-11T00:00:00.000Z', value: 3 },
      { timestamp: '2026-08-12T00:00:00.000Z', value: 4 },
      { timestamp: '2026-08-13T00:00:00.000Z', value: 1 },
      { timestamp: '2026-08-14T00:00:00.000Z', value: 2 },
      { timestamp: '2026-08-15T00:00:00.000Z', value: 4 },
    ]);
    expect(overview.trend.points.every((point) => point.value === null || point.value >= 0)).toBe(
      true,
    );
  });

  it('does not fabricate complete latest metrics without current-window observations', async () => {
    await seedComplete(database);
    await database.query(
      `DELETE FROM normalized_records
       WHERE record_kind IN ('repository.summary', 'issues.summary') AND effective_at >= $1`,
      ['2026-08-10T00:00:00Z'],
    );

    const overview = await readOverview(database, request());
    expect(change(overview, 'github.stars')).toMatchObject({
      availability: 'partial',
      current: null,
      previous: 110,
      delta: null,
    });
    expect(change(overview, 'github.open_issues')).toMatchObject({
      availability: 'partial',
      current: null,
      previous: 5,
      delta: null,
    });
  });

  it('bounds and resolves provenance when exact release evaluation exceeds the per-metric limit', async () => {
    await seedComplete(database);
    for (let index = 0; index < 30; index += 1) {
      await record(database, {
        id: id(500 + index),
        kind: 'release.summary',
        externalId: `overflow-release-${String(index).padStart(2, '0')}`,
        effectiveAt: `2026-08-${String(10 + (index % 7)).padStart(2, '0')}T12:${String(index).padStart(2, '0')}:00Z`,
        payload: release(1, `overflow-${index}`, '2026-08-10T00:00:00.000Z'),
      });
    }

    const overview = await readOverview(database, request());
    const releaseChange = change(overview, 'github.release_asset_downloads');
    expect(releaseChange).toMatchObject({
      availability: 'partial',
      current: null,
      previous: null,
      delta: null,
    });
    expect(releaseChange.provenanceRefs.length).toBeLessThanOrEqual(20);
    expect(overview.provenance.references.length).toBeLessThanOrEqual(500);
    expect(new Set(overview.provenance.references.map(({ ref }) => ref)).size).toBe(
      overview.provenance.references.length,
    );
    const available = new Set(overview.provenance.references.map(({ ref }) => ref));
    expect(releaseChange.provenanceRefs.every((ref) => available.has(ref))).toBe(true);
  });

  it('evaluates all release rows before bounding high-cardinality output', async () => {
    await seedComplete(database);
    for (let index = 0; index < 92; index += 1) {
      const isNewest = index === 91;
      await record(database, {
        id: id(700 + index),
        kind: 'release.summary',
        externalId: `high-cardinality-release-${String(index).padStart(2, '0')}`,
        effectiveAt: `2026-08-${isNewest ? '16' : String(10 + (index % 6)).padStart(2, '0')}T${isNewest ? '23:59' : `${String(Math.floor(index / 6)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`}:00Z`,
        payload: release(
          isNewest ? 777 : 1,
          isNewest ? 'v-high-cardinality-latest' : `v-high-cardinality-${index}`,
          isNewest ? '2026-08-16T23:59:00.000Z' : '2026-08-10T00:00:00.000Z',
        ),
      });
    }

    const overview = await readOverview(database, request());
    expect(change(overview, 'github.release_asset_downloads')).toMatchObject({
      availability: 'partial',
      current: null,
      previous: null,
      delta: null,
    });
    expect(overview.release).toMatchObject({
      tagName: 'v-high-cardinality-latest',
      publishedAt: '2026-08-16T23:59:00.000Z',
      assetDownloads: 777,
    });
    expect(overview.provenance.references.length).toBeLessThanOrEqual(500);
  });

  it('uses stable total ordering for tied records and annotations', async () => {
    await seedComplete(database);
    await record(database, {
      id: '30000000-0000-4000-8000-000000000050',
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-11T00:00:00Z',
      payload: { stars: 114 },
    });
    await Promise.all([
      database.query(
        `INSERT INTO annotations
           (id, scope, occurred_at, kind, title, evidence_url, created_at)
         VALUES ($1, $2, $3, 'release', 'Tie', $4, $5)`,
        [
          '50000000-0000-4000-8000-000000000002',
          scope,
          '2026-08-12T00:00:00Z',
          `${repositoryUrl}/releases/tag/b`,
          asOf,
        ],
      ),
      database.query(
        `INSERT INTO annotations
           (id, scope, occurred_at, kind, title, evidence_url, created_at)
         VALUES ($1, $2, $3, 'release', 'Tie', $4, $5)`,
        [
          '50000000-0000-4000-8000-000000000001',
          scope,
          '2026-08-12T00:00:00Z',
          `${repositoryUrl}/releases/tag/a`,
          asOf,
        ],
      ),
    ]);

    const first = await readOverview(database, request());
    const second = await readOverview(database, request());
    expect(first).toEqual(second);
    expect(first.trend.metricKey).toBe('github.release_asset_downloads');
    expect(first.trend.points.some((point) => point.value === 114)).toBe(false);
    expect(
      first.trend.annotations
        .filter((annotation) => annotation.label === 'Tie')
        .map((annotation) => annotation.id),
    ).toEqual(['50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002']);
  });

  it('strictly rejects unknown projects and non-canonical or incomplete window ends', async () => {
    expect(() => getProject('other-project')).toThrow('Unknown Observatory project: other-project');
    await expect(
      readOverview(database, { ...request(), projectKey: 'other-project' }),
    ).rejects.toThrow('Unknown Observatory project: other-project');
    await expect(
      readOverview(database, { ...request(), windowEnd: '2026-08-16T00:00:00.000Z' }),
    ).rejects.toThrow('windowEnd must be a completed Monday-to-Monday UTC boundary');
  });

  it('reports failed and empty states without leaking retained values', async () => {
    const empty = await readOverview(database, request());
    expect(empty.availability).toBe('empty');
    expect(
      empty.changes.every((item) => item.availability === 'empty' && item.current === null),
    ).toBe(true);

    await seedRun(
      database,
      '20000000-0000-4000-8000-000000000009',
      'failed',
      '2026-08-18T01:00:00Z',
    );
    await record(database, {
      id: '30000000-0000-4000-8000-000000000009',
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-16T00:00:00Z',
      payload: { stars: 44 },
    });
    const failed = await readOverview(database, request());
    expect(failed.availability).toBe('failed');
    expect(
      failed.changes.every((item) => item.availability === 'failed' && item.current === null),
    ).toBe(true);
    expect(failed.warnings[0]?.code).toBe('source_failure');
  });

  it('uses the PostgreSQL transaction timestamp when asOf is omitted', async () => {
    const before = Date.now();
    const overview = await readOverview(database, { projectKey: 'hermes-relay', period: '7d' });
    const after = Date.now();
    const observed = Date.parse(overview.asOf);
    expect(observed).toBeGreaterThanOrEqual(before - 1_000);
    expect(observed).toBeLessThanOrEqual(after + 1_000);
    expect(new Date(overview.window.end).getUTCDay()).toBe(1);
  });

  it('uses a read-only repeatable-read transaction and a stable snapshot during concurrent writes', async () => {
    await seedComplete(database);
    let releaseSnapshot = (): void => undefined;
    const snapshotReleased = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    let snapshotCaptured = (): void => undefined;
    const captured = new Promise<void>((resolve) => {
      snapshotCaptured = resolve;
    });
    let characteristics: { isolation: string; readOnly: string } | undefined;
    const wrapped = Object.create(database) as pg.Pool;
    wrapped.connect = async () => {
      const client = await database.connect();
      const query = client.query.bind(client);
      client.query = (async (...args: Parameters<typeof query>) => {
        // pg's overloads collapse under bind, so normalize this test seam to QueryResult.
        // eslint-disable-next-line @typescript-eslint/await-thenable
        const result = (await query(...args)) as unknown as pg.QueryResult;
        if (typeof args[0] === 'string' && args[0].includes('txid_current_snapshot')) {
          const row = result.rows[0] as { isolation: string; read_only: string };
          characteristics = { isolation: row.isolation, readOnly: row.read_only };
          snapshotCaptured();
          await snapshotReleased;
        }
        return result;
      }) as typeof client.query;
      return client;
    };

    const pending = readOverview(wrapped, request());
    await captured;
    await record(database, {
      id: id(999),
      kind: 'repository.summary',
      externalId: 'concurrent',
      effectiveAt: '2026-08-16T23:00:00Z',
      sourceCreatedAt: '2026-08-16T23:30:00Z',
      normalizedAt: '2026-08-16T23:30:00Z',
      payload: { stars: 777 },
    });
    releaseSnapshot();

    const overview = await pending;
    expect(characteristics).toEqual({ isolation: 'repeatable read', readOnly: 'on' });
    expect(overview.trend.points.some((point) => point.value === 777)).toBe(false);
  });

  it('aborts blocked PostgreSQL work, abandons its transaction, and keeps the pool usable', async () => {
    const blocker = await database.connect();
    const applicationName = `overview-abort-${process.pid}`;
    const abortPool = new Pool({
      connectionString: database.options.connectionString,
      application_name: applicationName,
      max: 1,
    });
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE normalized_records IN ACCESS EXCLUSIVE MODE');

      const controller = new AbortController();
      const pending = readOverview(abortPool, request(), { signal: controller.signal });
      const backendPid = await waitForBlockedOverview(database, applicationName);

      const startedAt = Date.now();
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(Date.now() - startedAt).toBeLessThan(1_000);
      await waitForOverviewGone(database, backendPid);

      await blocker.query('ROLLBACK');
      await expect(abortPool.query('SELECT 1 AS value')).resolves.toMatchObject({
        rows: [{ value: 1 }],
      });
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
      await abortPool.end();
    }
  });
});

async function waitForBlockedOverview(database: pg.Pool, applicationName: string): Promise<number> {
  const row = await waitForActivity(
    database,
    `application_name = $1`,
    [applicationName],
    (activity) => activity.wait_event_type === 'Lock',
  );
  if (row.pid === null) throw new Error('Blocked Overview query did not report a backend PID');
  return row.pid;
}

async function waitForOverviewGone(database: pg.Pool, backendPid: number): Promise<void> {
  await waitForActivity(database, `pid = $1`, [backendPid], (row) => row.count === '0');
}

async function waitForActivity(
  database: pg.Pool,
  condition: string,
  values: unknown[],
  predicate: (row: {
    count: string;
    pid: number | null;
    wait_event_type: string | null;
  }) => boolean,
): Promise<{ count: string; pid: number | null; wait_event_type: string | null }> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await database.query<{
      count: string;
      pid: number | null;
      wait_event_type: string | null;
    }>(
      `SELECT count(*)::text AS count, max(pid) AS pid, max(wait_event_type) AS wait_event_type
       FROM pg_stat_activity
       WHERE ${condition}`,
      values,
    );
    const row = result.rows[0];
    if (row && predicate(row)) return row;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for PostgreSQL activity: ${condition}`);
}

function request() {
  return { projectKey: 'hermes-relay', period: '7d' as const, windowEnd, asOf };
}

function change(overview: Awaited<ReturnType<typeof readOverview>>, metricKey: string) {
  const result = overview.changes.find((item) => item.metricKey === metricKey);
  if (!result) throw new Error(`Missing change ${metricKey}`);
  return result;
}

async function seedComplete(database: pg.Pool, runAt = '2026-08-18T01:00:00Z'): Promise<void> {
  const runId = '20000000-0000-4000-8000-000000000001';
  await seedRun(database, runId, 'succeeded', runAt);
  await database.query(
    `INSERT INTO source_checkpoint_history
       (source, scope, checkpoint_key, cursor, cursor_at, collection_run_id, recorded_at)
     VALUES ('github', $1, 'daily-collection', '{}'::jsonb, $2, $3, $2)`,
    [scope, runAt, runId],
  );

  const records: Parameters<typeof record>[1][] = [
    {
      id: id(1),
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-02T00:00:00Z',
      payload: { stars: 100 },
    },
    {
      id: id(2),
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-09T00:00:00Z',
      payload: { stars: 110 },
    },
    {
      id: id(3),
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-10T00:00:00Z',
      payload: { stars: 112 },
    },
    {
      id: id(4),
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-11T00:00:00Z',
      payload: { stars: 113 },
    },
    {
      id: id(5),
      kind: 'repository.summary',
      externalId: 'repository',
      effectiveAt: '2026-08-16T00:00:00Z',
      payload: { stars: 125 },
    },
    {
      id: id(6),
      kind: 'issues.summary',
      externalId: 'issues',
      effectiveAt: '2026-08-09T00:00:00Z',
      payload: { open: 5 },
    },
    {
      id: id(7),
      kind: 'issues.summary',
      externalId: 'issues',
      effectiveAt: '2026-08-16T00:00:00Z',
      payload: { open: 7 },
    },
    {
      id: id(8),
      kind: 'release.summary',
      externalId: 'release-1',
      effectiveAt: '2026-08-02T00:00:00Z',
      payload: release(10),
    },
    {
      id: id(9),
      kind: 'release.summary',
      externalId: 'release-1',
      effectiveAt: '2026-08-05T00:00:00Z',
      payload: release(14),
    },
    {
      id: id(10),
      kind: 'release.summary',
      externalId: 'release-1',
      effectiveAt: '2026-08-12T00:00:00Z',
      payload: release(18),
    },
    {
      id: id(11),
      kind: 'release.summary',
      externalId: 'release-1',
      effectiveAt: '2026-08-14T00:00:00Z',
      payload: release(2),
    },
  ];
  for (let day = 3; day <= 16; day += 1) {
    const current = day >= 10;
    records.push(
      {
        id: id(100 + day),
        kind: 'traffic.views',
        externalId: `views-${day}`,
        effectiveAt: `2026-08-${String(day).padStart(2, '0')}T00:00:00Z`,
        payload: { count: current ? day : 6 },
      },
      {
        id: id(200 + day),
        kind: 'traffic.clones',
        externalId: `clones-${day}`,
        effectiveAt: `2026-08-${String(day).padStart(2, '0')}T00:00:00Z`,
        payload: { count: current ? 3 : 2 },
      },
    );
  }
  for (const item of records) await record(database, item);

  await database.query(
    `INSERT INTO briefing_revisions
       (id, scope, window_start, window_end, metric_version, content_digest, content_markdown, created_at)
     VALUES ($1, $2, $3, $4, 1, 'digest', 'Deterministic weekly summary.', $5)`,
    ['60000000-0000-4000-8000-000000000001', scope, '2026-08-10T00:00:00Z', windowEnd, asOf],
  );
  await database.query(
    `INSERT INTO annotations (id, scope, occurred_at, kind, title, evidence_url, created_at)
     VALUES ($1, $2, $3, 'release', 'v1.0.0 release', $4, $5)`,
    [
      '50000000-0000-4000-8000-000000000000',
      scope,
      '2026-08-12T00:00:00Z',
      `${repositoryUrl}/releases/tag/v1.0.0`,
      asOf,
    ],
  );
}

async function seedRun(
  database: pg.Pool,
  idValue: string,
  status: string,
  finishedAt: string,
): Promise<void> {
  await database.query(
    `INSERT INTO collection_runs
       (id, source, scope, status, started_at, finished_at, error_summary, source_metadata)
     VALUES ($1, 'github', $2, $3, $4, $4, 'diagnostic secret', '{"visitor":"forbidden"}'::jsonb)`,
    [idValue, scope, status, finishedAt],
  );
}

interface RecordFixture {
  id: string;
  kind: string;
  externalId: string;
  effectiveAt: string;
  payload: Record<string, unknown>;
  sourceCreatedAt?: string;
  normalizedAt?: string;
}

async function record(database: pg.Pool, fixture: RecordFixture): Promise<void> {
  await database.query(
    `INSERT INTO normalized_records
       (id, source_observation_id, source, scope, record_kind, external_id, effective_at,
        schema_version, normalizer_version, payload, evidence_url, source_created_at, normalized_at)
     VALUES ($1, $2, 'github', $3, $4, $5, $6, 1, 1, $7::jsonb, $8, $9, $10)`,
    [
      fixture.id,
      fixture.id.replace('30000000', '40000000'),
      scope,
      fixture.kind,
      fixture.externalId,
      fixture.effectiveAt,
      JSON.stringify(fixture.payload),
      evidence(fixture),
      fixture.sourceCreatedAt ?? '2026-08-16T23:00:00Z',
      fixture.normalizedAt ?? '2026-08-16T23:00:00Z',
    ],
  );
}

function evidence(fixture: RecordFixture): string {
  if (fixture.kind === 'release.summary') return `${repositoryUrl}/releases/tag/v1.0.0`;
  if (fixture.kind.startsWith('traffic.')) return `${repositoryUrl}/graphs/traffic`;
  if (fixture.kind === 'issues.summary') return `${repositoryUrl}/issues`;
  return repositoryUrl;
}

function release(
  totalAssetDownloads: number,
  tag = 'v1.0.0',
  publishedAt = '2026-08-04T12:00:00.000Z',
) {
  return {
    tag,
    name: `Hermes-Relay ${tag}`,
    publishedAt,
    totalAssetDownloads,
  };
}

function id(value: number): string {
  return `30000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}

async function cleanup(database: pg.Pool): Promise<void> {
  await database.query(
    'TRUNCATE briefing_revisions, annotations, source_checkpoint_history, source_checkpoints, normalized_records, observations, collection_runs CASCADE',
  );
}
