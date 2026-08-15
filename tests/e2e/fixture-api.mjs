import http from 'node:http';

const port = Number(process.env.E2E_FIXTURE_API_PORT ?? 4100);
const expectedToken = process.env.E2E_API_TOKEN ?? 'ci-local-overview-token-0001';
let mode = 'complete';
let overviewRequests = [];
let refreshRequests = 0;

const baseWithHistory = {
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
    staleAfter: '2026-08-10T06:01:00.000Z',
  },
  warnings: [],
  changes: [
    {
      metricKey: 'github.stars',
      label: 'Stars',
      unit: 'count',
      availability: 'complete',
      current: 120,
      previous: 115,
      delta: 5,
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay/stargazers',
      provenanceRefs: [],
    },
    {
      metricKey: 'github.views',
      label: 'Page views',
      unit: 'views',
      availability: 'complete',
      current: 60,
      previous: 50,
      delta: 10,
      evidenceUrl: null,
      provenanceRefs: [],
    },
    {
      metricKey: 'github.clones',
      label: 'Repository clones',
      unit: 'clones',
      availability: 'complete',
      current: 22,
      previous: 20,
      delta: 2,
      evidenceUrl: null,
      provenanceRefs: [],
    },
    {
      metricKey: 'github.release_asset_downloads',
      label: 'Release asset downloads',
      unit: 'downloads',
      availability: 'complete',
      current: 31,
      previous: 21,
      delta: 10,
      evidenceUrl: null,
      provenanceRefs: [],
    },
    {
      metricKey: 'github.open_issues',
      label: 'Open issues',
      unit: 'count',
      availability: 'complete',
      current: 8,
      previous: 10,
      delta: -2,
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay/issues',
      provenanceRefs: [],
    },
  ],
  history: {
    version: 1,
    project: {
      key: 'hermes-relay',
      name: 'Hermes-Relay',
      repository: 'Codename-11/hermes-relay',
      scope: 'Codename-11/hermes-relay',
    },
    period: '180d',
    window: {
      start: '2026-04-01T00:00:00.000Z',
      end: '2026-08-10T00:05:00.000Z',
    },
    asOf: '2026-08-10T00:05:00.000Z',
    series: [
      {
        metricKey: 'github.stars',
        label: 'Active-star cohort',
        unit: 'count',
        bucket: 'calendar-month-end',
        method: 'lower-bound',
        availability: 'partial',
        limitation: 'People who later unstarred are absent.',
        reasonCode: 'reconstructed-lower-bound',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/stargazers',
        points: [
          {
            timestamp: '2026-04-09T00:00:00.000Z',
            value: 1,
            availability: 'partial',
            provenanceRefs: [],
          },
          {
            timestamp: '2026-08-10T00:00:00.000Z',
            value: 120,
            availability: 'partial',
            provenanceRefs: [],
          },
        ],
      },
      {
        metricKey: 'github.open_issues',
        label: 'Open issues',
        unit: 'count',
        bucket: 'calendar-month-end',
        method: 'reconstructed',
        availability: 'partial',
        limitation: 'Reconstructed from issue lifecycle events.',
        reasonCode: 'reconstructed',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/issues',
        points: [
          {
            timestamp: '2026-04-09T00:00:00.000Z',
            value: 0,
            availability: 'partial',
            provenanceRefs: [],
          },
          {
            timestamp: '2026-08-10T00:00:00.000Z',
            value: 8,
            availability: 'partial',
            provenanceRefs: [],
          },
        ],
      },
      {
        metricKey: 'github.views',
        label: 'Page views',
        unit: 'views',
        bucket: 'utc-day',
        method: 'observed',
        availability: 'partial',
        limitation: 'Earlier traffic history is unavailable.',
        reasonCode: 'source-rolling-window',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/graphs/traffic',
        points: [
          {
            timestamp: '2026-08-09T00:00:00.000Z',
            value: 9,
            availability: 'complete',
            provenanceRefs: [],
          },
          {
            timestamp: '2026-08-10T00:00:00.000Z',
            value: 12,
            availability: 'complete',
            provenanceRefs: [],
          },
        ],
      },
      {
        metricKey: 'github.clones',
        label: 'Repository clones',
        unit: 'clones',
        bucket: 'utc-day',
        method: 'observed',
        availability: 'partial',
        limitation: 'Earlier traffic history is unavailable.',
        reasonCode: 'source-rolling-window',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/graphs/traffic',
        points: [
          {
            timestamp: '2026-08-09T00:00:00.000Z',
            value: 3,
            availability: 'complete',
            provenanceRefs: [],
          },
          {
            timestamp: '2026-08-10T00:00:00.000Z',
            value: 5,
            availability: 'complete',
            provenanceRefs: [],
          },
        ],
      },
    ],
    provenance: {
      scope: 'Codename-11/hermes-relay',
      generatedAt: '2026-08-10T00:05:00.000Z',
      references: [],
    },
  },
  trend: {
    metricKey: 'github.release_asset_downloads',
    label: 'Release asset downloads',
    unit: 'downloads',
    availability: 'complete',
    points: [
      {
        timestamp: '2026-08-04T00:00:00.000Z',
        value: 0,
        availability: 'complete',
        provenanceRefs: [],
      },
      {
        timestamp: '2026-08-05T00:00:00.000Z',
        value: 19,
        availability: 'complete',
        provenanceRefs: [],
      },
    ],
    annotations: [],
  },
  release: {
    availability: 'complete',
    tagName: 'v1.2.3',
    name: 'Hermes-Relay v1.2.3',
    publishedAt: '2026-08-04T12:00:00.000Z',
    evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
    assetDownloads: 31,
    provenanceRefs: [],
  },
  briefing: {
    availability: 'complete',
    summary: 'Evidence was assembled for this completed review window.',
    generatedAt: '2026-08-10T00:03:00.000Z',
    evidenceUrl: null,
    provenanceRefs: [],
  },
  sources: [
    {
      key: 'github',
      label: 'GitHub',
      availability: 'complete',
      lastAttemptAt: '2026-08-10T00:01:00.000Z',
      lastSuccessfulAt: '2026-08-10T00:01:00.000Z',
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay',
      warnings: [],
      provenanceRefs: [],
    },
  ],
  attention: [],
  provenance: {
    scope: 'Codename-11/hermes-relay',
    metricDefinitionVersion: 1,
    windowEnd: '2026-08-10T00:00:00.000Z',
    asOf: '2026-08-10T00:05:00.000Z',
    generatedAt: '2026-08-10T00:05:00.000Z',
    references: [
      {
        ref: 'observation:fixture-1',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay',
      },
    ],
  },
};

const { history, ...base } = baseWithHistory;

const fixture = () => {
  const value = structuredClone(base);
  if (mode === 'partial') {
    value.availability = 'partial';
    value.freshness.availability = 'partial';
    value.warnings = [
      {
        code: 'incomplete_metric_window',
        message: 'One metric interval is incomplete.',
        metricKey: 'github.views',
      },
    ];
    value.changes[1] = { ...value.changes[1], availability: 'partial', current: null, delta: null };
  }
  return value;
};

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 */
const json = (response, status, body) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
  });
  response.end(JSON.stringify(body));
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  if (request.method === 'GET' && url.pathname === '/health')
    return json(response, 200, { ok: true });
  if (request.method === 'POST' && url.pathname === '/__fixture/reset') {
    mode = url.searchParams.get('mode') === 'partial' ? 'partial' : 'complete';
    overviewRequests = [];
    refreshRequests = 0;
    return json(response, 200, { mode });
  }
  if (request.method === 'GET' && url.pathname === '/__fixture/requests') {
    return json(response, 200, { overviewRequests, refreshRequests });
  }
  if (request.method === 'GET' && url.pathname === '/api/v1/projects/hermes-relay/history') {
    if (request.headers.authorization !== `Bearer ${expectedToken}`)
      return json(response, 401, { title: 'Unauthorized' });
    return json(response, 200, history);
  }
  if (request.method === 'GET' && url.pathname === '/api/v1/projects/hermes-relay/overview') {
    const authorization = request.headers.authorization ?? null;
    overviewRequests.push({
      authorization,
      accept: request.headers.accept ?? null,
      period: url.searchParams.get('period'),
      view: url.searchParams.get('view'),
    });
    if (authorization !== `Bearer ${expectedToken}`)
      return json(response, 401, { title: 'Unauthorized' });
    return json(response, 200, { ...fixture(), view: url.searchParams.get('view') ?? 'completed' });
  }
  if (request.method === 'POST' && url.pathname === '/api/v1/projects/hermes-relay/refresh') {
    if (request.headers.authorization !== `Bearer ${expectedToken}`)
      return json(response, 401, { title: 'Unauthorized' });
    refreshRequests += 1;
    return json(response, 200, { status: 'completed', joined: false });
  }
  return json(response, 404, { title: 'Not found' });
});

server.listen(port, '127.0.0.1', () =>
  console.log(`deterministic fixture API listening on ${port}`),
);
