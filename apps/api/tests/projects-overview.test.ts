import { describe, expect, it, vi } from 'vitest';

import { loadConfig, type ApiConfig } from '../src/config.js';
import { buildServer, type HistoryReader, type OverviewReader } from '../src/server.js';

const overview = {
  version: 1,
  project: {
    key: 'hermes-relay',
    name: 'Hermes-Relay',
    repository: 'Codename-11/hermes-relay',
    scope: 'Codename-11/hermes-relay',
  },
  period: '7d',
  window: {
    start: '2026-08-03T00:00:00.000Z',
    end: '2026-08-10T00:00:00.000Z',
    comparisonStart: '2026-07-27T00:00:00.000Z',
    comparisonEnd: '2026-08-03T00:00:00.000Z',
  },
  asOf: '2026-08-10T00:05:00.000Z',
  availability: 'complete',
  freshness: {
    availability: 'complete',
    checkedAt: '2026-08-10T00:05:00.000Z',
    lastSuccessfulAt: '2026-08-10T00:01:00.000Z',
    staleAfter: '2026-08-11T06:01:00.000Z',
  },
  warnings: [],
  changes: [],
  trend: {
    metricKey: 'github.release_asset_downloads',
    label: 'Release asset downloads',
    unit: 'downloads',
    availability: 'empty',
    points: [],
    annotations: [],
  },
  release: null,
  briefing: {
    availability: 'empty',
    summary: null,
    generatedAt: null,
    evidenceUrl: null,
    provenanceRefs: [],
  },
  sources: [],
  attention: [],
  provenance: {
    scope: 'Codename-11/hermes-relay',
    metricDefinitionVersion: 1,
    windowEnd: '2026-08-10T00:00:00.000Z',
    asOf: '2026-08-10T00:05:00.000Z',
    generatedAt: '2026-08-10T00:05:00.000Z',
    references: [],
  },
} as const;

const authConfig: ApiConfig = {
  nodeEnv: 'test' as const,
  host: '127.0.0.1',
  port: 3_000,
  databaseUrl: 'postgresql://observatory:secret@localhost/observatory',
  authToken: 'correct horse battery staple',
  authBypass: false,
  poolMax: 4,
  connectionTimeoutMs: 1_000,
  idleTimeoutMs: 10_000,
  queryTimeoutMs: 5_000,
  requestTimeoutMs: 10_000,
  concurrencyLimit: 8,
  rateLimitMax: 60,
  rateLimitWindowMs: 60_000,
  refreshEnabled: false,
  refreshTimeoutMs: 60_000,
};

const headers = { authorization: `Bearer ${authConfig.authToken}` };
const reader: OverviewReader = vi.fn(() => Promise.resolve(overview));
const history = {
  version: 1,
  project: overview.project,
  period: '180d',
  window: { start: '2026-02-11T00:00:00.000Z', end: overview.asOf },
  asOf: overview.asOf,
  series: [
    [
      'github.stars',
      'Active-star cohort at month end',
      'count',
      'calendar-month-end',
      'lower-bound',
      'reconstructed-lower-bound',
    ],
    [
      'github.open_issues',
      'Reconstructed open issues at month end',
      'count',
      'calendar-month-end',
      'reconstructed',
      'reconstructed',
    ],
    [
      'github.views',
      'Observed page views',
      'views',
      'utc-day',
      'observed',
      'source-rolling-window',
    ],
    [
      'github.clones',
      'Observed repository clones',
      'clones',
      'utc-day',
      'observed',
      'source-rolling-window',
    ],
  ].map(([metricKey, label, unit, bucket, method, reasonCode]) => ({
    metricKey,
    label,
    unit,
    bucket,
    method,
    availability: 'unavailable',
    limitation: 'Fixture limitation.',
    reasonCode,
    evidenceUrl: null,
    points: [],
  })),
  provenance: {
    scope: 'Codename-11/hermes-relay',
    generatedAt: overview.asOf,
    references: [],
  },
} as const;
const historyReader: HistoryReader = vi.fn(() => Promise.resolve(history));

const problem = (response: {
  headers: Record<string, string | number | string[] | undefined>;
  json(): unknown;
}) => {
  expect(response.headers['content-type']).toContain('application/problem+json');
  return response.json();
};

describe('configuration', () => {
  it('fails closed in production without a static bearer token', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DATABASE_URL: authConfig.databaseUrl }),
    ).toThrow('API_AUTH_TOKEN is required in production');
  });

  it('cannot activate the development bypass in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: authConfig.databaseUrl,
        API_AUTH_BYPASS: 'true',
        API_AUTH_TOKEN: authConfig.authToken,
      }),
    ).toThrow('API_AUTH_BYPASS cannot be enabled in production');
  });

  it('requires an explicit true value to bypass auth outside production', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DATABASE_URL: authConfig.databaseUrl,
      API_AUTH_BYPASS: 'true',
    });
    expect(config.authBypass).toBe(true);
    expect(() =>
      loadConfig({
        NODE_ENV: 'development',
        DATABASE_URL: authConfig.databaseUrl,
        API_AUTH_BYPASS: 'yes',
      }),
    ).toThrow('API_AUTH_BYPASS must be true or false');
  });

  it('validates bounded pool and timeout configuration', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: authConfig.databaseUrl,
        API_AUTH_TOKEN: authConfig.authToken,
        API_DB_POOL_MAX: '1000',
      }),
    ).toThrow('API_DB_POOL_MAX');
  });

  it('requires an explicit boolean to enable the fixed refresh trigger', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: authConfig.databaseUrl,
        API_AUTH_TOKEN: authConfig.authToken,
        API_REFRESH_ENABLED: 'yes',
      }),
    ).toThrow('API_REFRESH_ENABLED must be true or false');
    expect(
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: authConfig.databaseUrl,
        API_AUTH_TOKEN: authConfig.authToken,
        API_REFRESH_ENABLED: 'true',
      }).refreshEnabled,
    ).toBe(true);
  });
});

describe('read-only Overview API', () => {
  it('serves independently validated historical context with constrained query parameters', async () => {
    const app = buildServer({
      config: authConfig,
      readOverview: reader,
      readHistory: historyReader,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/history?period=180d',
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(history);
    expect(historyReader).toHaveBeenCalledWith(
      { projectKey: 'hermes-relay', period: '180d' },
      expect.any(AbortSignal),
    );
    const rejected = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/history?period=180d&view=current',
      headers,
    });
    expect(rejected.statusCode).toBe(400);
    await app.close();
  });

  it('denies missing, malformed, and incorrect bearer credentials without leaking details', async () => {
    const app = buildServer({ config: authConfig, readOverview: reader });
    for (const candidate of [undefined, 'Basic abc', 'Bearer wrong', 'Bearer a,b']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects/hermes-relay/overview?period=7d',
        ...(candidate === undefined ? {} : { headers: { authorization: candidate } }),
      });
      expect(response.statusCode).toBe(401);
      expect(problem(response)).toEqual({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication is required.',
      });
      expect(response.payload).not.toContain(authConfig.authToken);
    }
    await app.close();
  });

  it('allows only an explicit non-production bypass', async () => {
    const bypassConfig: ApiConfig = {
      nodeEnv: authConfig.nodeEnv,
      host: authConfig.host,
      port: authConfig.port,
      databaseUrl: authConfig.databaseUrl,
      authBypass: true,
      poolMax: authConfig.poolMax,
      connectionTimeoutMs: authConfig.connectionTimeoutMs,
      idleTimeoutMs: authConfig.idleTimeoutMs,
      queryTimeoutMs: authConfig.queryTimeoutMs,
      requestTimeoutMs: authConfig.requestTimeoutMs,
      concurrencyLimit: authConfig.concurrencyLimit,
      rateLimitMax: authConfig.rateLimitMax,
      rateLimitWindowMs: authConfig.rateLimitWindowMs,
      refreshEnabled: authConfig.refreshEnabled,
      refreshTimeoutMs: authConfig.refreshTimeoutMs,
    };
    const app = buildServer({
      config: bypassConfig,
      readOverview: reader,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d',
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('accepts strict canonical query values and forwards the shared request contract', async () => {
    const readOverview = vi.fn<OverviewReader>(() => Promise.resolve(overview));
    const app = buildServer({ config: authConfig, readOverview });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d&view=current&asOf=2026-08-10T00%3A05%3A00.000Z',
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(readOverview).toHaveBeenCalledWith(
      {
        projectKey: 'hermes-relay',
        period: '7d',
        view: 'current',
        asOf: '2026-08-10T00:05:00.000Z',
      },
      expect.any(AbortSignal),
    );
    expect(response.json()).toEqual(overview);
    await app.close();
  });

  it.each([
    'period=30d',
    'period=7d&period=7d',
    'period=7d&view=streaming',
    'period=7d&view=current&windowEnd=2026-08-10T00%3A00%3A00.000Z',
    'period=7d&unknown=true',
    'period=7d&asOf=2026-08-10T00%3A05%3A00Z',
    'period=7d&windowEnd=2026-08-10T01%3A00%3A00.000%2B01%3A00',
    'period=7d&asOf=%ZZ',
  ])('rejects malformed, duplicate, unknown, or unsupported query: %s', async (query) => {
    const app = buildServer({ config: authConfig, readOverview: reader });
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/hermes-relay/overview?${query}`,
      headers,
    });
    expect(response.statusCode).toBe(400);
    expect(problem(response)).toMatchObject({ status: 400, title: 'Bad Request' });
    expect(response.payload).not.toContain('%ZZ');
    await app.close();
  });

  it('rejects unsupported projects without calling the read model', async () => {
    const readOverview = vi.fn<OverviewReader>(() => Promise.resolve(overview));
    const app = buildServer({ config: authConfig, readOverview });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/other/overview?period=7d',
      headers,
    });
    expect(response.statusCode).toBe(404);
    expect(readOverview).not.toHaveBeenCalled();
    expect(problem(response)).toMatchObject({ status: 404, title: 'Not Found' });
    await app.close();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'provides no mutation route for %s',
    async (method) => {
      const app = buildServer({ config: authConfig, readOverview: reader });
      const response = await app.inject({
        method,
        url: '/api/v1/projects/hermes-relay/overview?period=7d',
        headers,
      });
      expect(response.statusCode).toBe(404);
      await app.close();
    },
  );

  it('rejects a body on GET', async () => {
    const app = buildServer({ config: authConfig, readOverview: reader });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { raw: true },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('sets private caching and hardened response headers', async () => {
    const app = buildServer({ config: authConfig, readOverview: reader });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d',
      headers,
    });
    expect(response.headers).toMatchObject({
      'cache-control': 'private, no-store',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    });
    await app.close();
  });

  it('validates the response contract and sanitizes internal failures', async () => {
    const invalidReader: OverviewReader = () => Promise.resolve({ secret: 'database-password' });
    const app = buildServer({ config: authConfig, readOverview: invalidReader });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d',
      headers,
    });
    expect(response.statusCode).toBe(500);
    expect(problem(response)).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'The request could not be completed.',
    });
    expect(response.payload).not.toContain('database-password');
    await app.close();
  });

  it('times out a stalled reader and releases its sole concurrency slot', async () => {
    let firstSignal: AbortSignal | undefined;
    const readOverview = vi.fn<OverviewReader>((_request, signal) => {
      if (readOverview.mock.calls.length === 1) {
        firstSignal = signal;
        return new Promise(() => undefined);
      }
      return Promise.resolve(overview);
    });
    const app = buildServer({
      config: { ...authConfig, concurrencyLimit: 1, requestTimeoutMs: 25 },
      readOverview,
    });

    const startedAt = Date.now();
    const timedOut = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d',
      headers,
    });
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(timedOut.statusCode).toBe(504);
    expect(problem(timedOut)).toEqual({
      type: 'about:blank',
      title: 'Gateway Timeout',
      status: 504,
      detail: 'The request timed out.',
    });
    expect(firstSignal?.aborted).toBe(true);
    expect(timedOut.headers).toMatchObject({
      'cache-control': 'private, no-store',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    });

    const following = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/hermes-relay/overview?period=7d',
      headers,
    });
    expect(following.statusCode).toBe(200);
    expect(readOverview).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('keeps manual refresh authenticated, disabled by default, and bodyless', async () => {
    const disabled = buildServer({ config: authConfig, readOverview: reader });
    const unauthorized = await disabled.inject({
      method: 'POST',
      url: '/api/v1/projects/hermes-relay/refresh',
    });
    expect(unauthorized.statusCode).toBe(401);
    const unavailable = await disabled.inject({
      method: 'POST',
      url: '/api/v1/projects/hermes-relay/refresh',
      headers,
    });
    expect(unavailable.statusCode).toBe(503);
    await disabled.close();

    const triggerRefresh = vi.fn(() => Promise.resolve());
    const enabled = buildServer({ config: authConfig, readOverview: reader, triggerRefresh });
    const body = await enabled.inject({
      method: 'POST',
      url: '/api/v1/projects/hermes-relay/refresh',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { command: 'anything' },
    });
    expect(body.statusCode).toBe(400);
    expect(triggerRefresh).not.toHaveBeenCalled();
    await enabled.close();
  });

  it('joins concurrent refresh requests to one fixed trigger', async () => {
    let finish: (() => void) | undefined;
    const triggerRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const app = buildServer({ config: authConfig, readOverview: reader, triggerRefresh });
    const first = app.inject({
      method: 'POST',
      url: '/api/v1/projects/hermes-relay/refresh',
      headers,
    });
    await vi.waitFor(() => expect(triggerRefresh).toHaveBeenCalledTimes(1));
    const second = app.inject({
      method: 'POST',
      url: '/api/v1/projects/hermes-relay/refresh',
      headers,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(triggerRefresh).toHaveBeenCalledTimes(1);
    finish?.();
    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(
      responses.map((response) => response.json<{ status: 'completed'; joined: boolean }>()),
    ).toEqual([
      { status: 'completed', joined: false },
      { status: 'completed', joined: true },
    ]);
    await app.close();
  });

  it('exposes a minimal public health response', async () => {
    const app = buildServer({ config: authConfig, readOverview: reader });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(Object.keys(response.json())).toEqual(['ok']);
    const head = await app.inject({ method: 'HEAD', url: '/health' });
    expect(head.statusCode).toBe(404);
    await app.close();
  });

  it('applies a coarse global rate limit without tracking identity', async () => {
    const app = buildServer({
      config: { ...authConfig, rateLimitMax: 1 },
      readOverview: reader,
    });
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const limited = await app.inject({ method: 'GET', url: '/health' });
    expect(limited.statusCode).toBe(429);
    expect(problem(limited)).toMatchObject({ status: 429, title: 'Too Many Requests' });
    await app.close();
  });
});
