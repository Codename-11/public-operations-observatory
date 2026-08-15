import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type {
  HistoricalContextReadModelV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';

import { OverviewPanels } from '../components/overview/overview-panels';
import { ObservatoryShell } from '../components/shell/observatory-shell';
import {
  fetchHistoricalContext,
  fetchOverview,
  requestOverviewRefresh,
  type OverviewApiResult,
} from '../lib/api';

const at = '2026-08-10T00:05:00.000Z';
const baseOverview = (): OverviewReadModelV1 => ({
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
  asOf: at,
  availability: 'complete',
  freshness: {
    availability: 'complete',
    checkedAt: at,
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
      label: 'Views',
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
      label: 'Clones',
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
  trend: {
    metricKey: 'github.release_asset_downloads',
    label: 'Release asset downloads',
    unit: 'downloads',
    availability: 'complete',
    points: [
      {
        timestamp: '2026-08-04T00:00:00.000Z',
        value: 12,
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
    asOf: at,
    generatedAt: at,
    references: [
      {
        ref: 'observation:1',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay',
      },
    ],
  },
});

const historyFixture = (): HistoricalContextReadModelV1 => ({
  version: 1,
  project: baseOverview().project,
  period: '180d',
  window: { start: '2026-02-11T00:00:00.000Z', end: at },
  asOf: at,
  series: [
    {
      metricKey: 'github.stars',
      label: 'Active-star cohort at month end',
      unit: 'count',
      bucket: 'calendar-month-end',
      method: 'lower-bound',
      availability: 'partial',
      limitation: 'Later unstars are absent.',
      reasonCode: 'reconstructed-lower-bound',
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay/stargazers',
      points: [],
    },
    {
      metricKey: 'github.open_issues',
      label: 'Reconstructed open issues at month end',
      unit: 'count',
      bucket: 'calendar-month-end',
      method: 'reconstructed',
      availability: 'partial',
      limitation: 'Derived from lifecycle events.',
      reasonCode: 'reconstructed',
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay/issues',
      points: [],
    },
    {
      metricKey: 'github.views',
      label: 'Observed page views',
      unit: 'views',
      bucket: 'utc-day',
      method: 'observed',
      availability: 'unavailable',
      limitation: 'Earlier traffic is unavailable.',
      reasonCode: 'source-rolling-window',
      evidenceUrl: null,
      points: [],
    },
    {
      metricKey: 'github.clones',
      label: 'Observed repository clones',
      unit: 'clones',
      bucket: 'utc-day',
      method: 'observed',
      availability: 'unavailable',
      limitation: 'Earlier traffic is unavailable.',
      reasonCode: 'source-rolling-window',
      evidenceUrl: null,
      points: [],
    },
  ],
  provenance: {
    scope: 'Codename-11/hermes-relay',
    generatedAt: at,
    references: [],
  },
});

const result = (data: OverviewReadModelV1): OverviewApiResult => ({ ok: true, data });

describe('server Overview API client', () => {
  it('uses authenticated no-store reads and validates the contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(baseOverview()), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
      }),
    );
    await expect(
      fetchOverview('hermes-relay', {
        fetcher,
        baseUrl: 'https://api.internal.example',
        token: 'secret-token',
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.internal.example/api/v1/projects/hermes-relay/overview?period=7d&view=current',
      expect.objectContaining({
        cache: 'no-store',
        headers: { accept: 'application/json', authorization: 'Bearer secret-token' },
      }),
    );
  });

  it('fetches historical context through its separate authenticated contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(historyFixture()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(
      fetchHistoricalContext('hermes-relay', {
        fetcher,
        baseUrl: 'http://127.0.0.1:4100',
        token: 'server-only-token',
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:4100/api/v1/projects/hermes-relay/history?period=180d',
      expect.objectContaining({
        cache: 'no-store',
        headers: { accept: 'application/json', authorization: 'Bearer server-only-token' },
      }),
    );
  });

  it('requests refresh server-to-server without a browser-visible body or credential', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: 'completed', joined: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      requestOverviewRefresh('hermes-relay', {
        fetcher,
        baseUrl: 'https://api.internal.example',
        token: 'server-only-token',
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.internal.example/api/v1/projects/hermes-relay/refresh',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: 'Bearer server-only-token',
        },
        cache: 'no-store',
        redirect: 'error',
      },
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('allows a production server to call a loopback HTTP API', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(baseOverview()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    try {
      await expect(
        fetchOverview('hermes-relay', {
          fetcher,
          baseUrl: 'http://127.0.0.1:4100',
          token: 'server-only-token',
        }),
      ).resolves.toMatchObject({ ok: true });
      expect(fetcher).toHaveBeenCalledWith(
        'http://127.0.0.1:4100/api/v1/projects/hermes-relay/overview?period=7d&view=current',
        expect.any(Object),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects non-loopback plaintext API origins', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      fetchOverview('hermes-relay', {
        fetcher,
        baseUrl: 'http://api.internal.example',
        token: 'server-only-token',
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'configuration' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['missing configuration', { baseUrl: '', token: '', fetcher: vi.fn() }],
    [
      'network failure',
      {
        baseUrl: 'https://api.internal.example',
        token: 'secret',
        fetcher: vi.fn().mockRejectedValue(new Error('contains secret-token')),
      },
    ],
    [
      'problem response',
      {
        baseUrl: 'https://api.internal.example',
        token: 'secret',
        fetcher: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ title: 'Unauthorized', detail: 'token secret' }), {
            status: 401,
            headers: { 'content-type': 'application/problem+json' },
          }),
        ),
      },
    ],
    [
      'invalid response',
      {
        baseUrl: 'https://api.internal.example',
        token: 'secret',
        fetcher: vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ version: 1 }), { status: 200 })),
      },
    ],
  ])('fails safely for %s without returning diagnostics', async (_label, options) => {
    const value = await fetchOverview('hermes-relay', options);
    expect(value.ok).toBe(false);
    if (!value.ok) {
      expect(['configuration', 'network', 'status', 'invalid-response']).toContain(value.kind);
      expect(value.message).toBe('Overview data is unavailable.');
    }
    expect(JSON.stringify(value)).not.toMatch(/secret|Unauthorized|token/i);
  });
});

describe('real Overview panels', () => {
  it('renders supported complete fields, comparisons, release trend table, and no unsupported actions', () => {
    render(<OverviewPanels result={result(baseOverview())} />);
    expect(screen.getByRole('heading', { name: 'What changed' })).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('115 prior')).toBeInTheDocument();
    expect(screen.getAllByText('Release asset downloads').length).toBeGreaterThan(0);
    expect(screen.getByRole('table', { name: 'Release asset downloads data' })).toBeInTheDocument();
    expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    expect(screen.queryByText(/funnel|caused|discovery/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acknowledge|snooze/i })).not.toBeInTheDocument();
  });

  it('renders trend annotations and claim-level evidence links without previews', () => {
    const data = baseOverview();
    data.trend.annotations = [
      {
        id: 'annotation:release:v1.2.3',
        kind: 'release',
        label: 'v1.2.3 published',
        occurredAt: '2026-08-04T12:00:00.000Z',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
        provenanceRefs: [],
      },
    ];
    data.attention = [
      {
        kind: 'incomplete_metric_window',
        sourceKey: 'github',
        severity: 'warning',
        title: 'Traffic interval incomplete',
        detail: 'The current traffic interval has incomplete evidence.',
        detectedAt: at,
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay/traffic/views',
        provenanceRefs: [],
      },
    ];

    render(<OverviewPanels result={result(data)} />);

    expect(screen.getByRole('heading', { name: 'Timeline annotations' })).toBeInTheDocument();
    expect(screen.getByText('v1.2.3 published')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Open evidence for v1.2.3 published (opens in a new tab)',
      }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      screen.getByRole('link', { name: 'Open Stars evidence (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://github.com/Codename-11/hermes-relay/stargazers');
    expect(
      screen.getByRole('link', {
        name: 'Open evidence for Traffic interval incomplete (opens in a new tab)',
      }),
    ).toHaveAttribute(
      'href',
      'https://api.github.com/repos/Codename-11/hermes-relay/traffic/views',
    );
    expect(document.querySelector('iframe, img, video')).toBeNull();
  });

  it.each(['failed', 'empty'] as const)(
    'preserves timeline annotations when trend values are %s',
    (availability) => {
      const data = baseOverview();
      data.trend = {
        ...data.trend,
        availability,
        points: [],
        annotations: [
          {
            id: `annotation:${availability}:release`,
            kind: 'release',
            label: `${availability} trend release context`,
            occurredAt: '2026-08-04T12:00:00.000Z',
            evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
            provenanceRefs: [],
          },
        ],
      };

      render(<OverviewPanels result={result(data)} />);

      expect(screen.getByRole('heading', { name: 'Timeline annotations' })).toBeInTheDocument();
      expect(screen.getByText(`${availability} trend release context`)).toBeInTheDocument();
    },
  );

  it('does not contradict a loaded Overview with a shell-level unavailable status', () => {
    render(
      <ObservatoryShell projectKey="hermes-relay">
        <OverviewPanels result={result(baseOverview())} />
      </ObservatoryShell>,
    );

    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Awaiting overview data/i)).not.toBeInTheDocument();
  });

  it('renders a zero-valued download interval with zero visual height', () => {
    const data = baseOverview();
    const firstPoint = data.trend.points[0]!;
    data.trend.points[0] = {
      timestamp: firstPoint.timestamp,
      availability: 'complete',
      value: 0,
      provenanceRefs: firstPoint.provenanceRefs,
    };

    const { container } = render(<OverviewPanels result={result(data)} />);
    const bars = container.querySelectorAll<HTMLElement>('.trend-bar');

    expect(bars[0]).toHaveStyle({ height: '0' });
    expect(screen.getByRole('table', { name: 'Release asset downloads data' })).toHaveTextContent(
      '0',
    );
  });

  it.each(['partial', 'stale', 'failed', 'empty'] as const)(
    'renders an honest %s state while preserving available panels',
    (availability) => {
      const data = baseOverview();
      data.availability = availability;
      data.freshness.availability = availability;
      if (availability === 'failed' || availability === 'empty') {
        const original = data.changes[1]!;
        data.changes[1] = {
          metricKey: original.metricKey,
          label: original.label,
          unit: original.unit,
          evidenceUrl: original.evidenceUrl,
          provenanceRefs: original.provenanceRefs,
          availability,
          current: null,
          previous: null,
          delta: null,
        };
      }
      render(<OverviewPanels result={result(data)} />);
      expect(screen.getAllByText(new RegExp(availability, 'i')).length).toBeGreaterThan(0);
      expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    },
  );

  it('isolates unavailable metrics and an unavailable trend', () => {
    const data = baseOverview();
    const stars = data.changes[0]!;
    data.changes[0] = {
      metricKey: stars.metricKey,
      label: stars.label,
      unit: stars.unit,
      evidenceUrl: stars.evidenceUrl,
      provenanceRefs: stars.provenanceRefs,
      availability: 'failed',
      current: null,
      previous: null,
      delta: null,
    };
    data.trend = {
      ...data.trend,
      availability: 'failed',
      points: data.trend.points.map((point) => ({ ...point, availability: 'failed', value: null })),
    };
    render(<OverviewPanels result={result(data)} />);
    expect(screen.getByText('Stars unavailable')).toBeInTheDocument();
    expect(screen.getByText('Trend unavailable')).toBeInTheDocument();
    expect(screen.getByText('Views')).toBeInTheDocument();
  });

  it('derives trend accessibility text from the contract and rejects a masquerading star trend', () => {
    const data = baseOverview();
    data.trend = {
      ...data.trend,
      metricKey: 'github.stars',
      label: 'Star count',
      unit: 'count',
    };
    render(<OverviewPanels result={result(data)} />);
    expect(screen.getByRole('heading', { name: 'Star count' })).toBeInTheDocument();
    expect(screen.getByText('Trend metric unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Star count data' })).not.toBeInTheDocument();
  });

  it.each(['partial', 'stale'] as const)(
    'preserves an honest %s trend when every interval value is unavailable',
    (availability) => {
      const data = baseOverview();
      data.trend = {
        ...data.trend,
        availability,
        points: data.trend.points.map((point) => ({
          ...point,
          availability,
          value: null,
        })),
      };

      render(<OverviewPanels result={result(data)} />);

      expect(
        screen.getByText(`${availability === 'stale' ? 'Stale' : 'Partial'} trend`),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('No release asset download intervals are available.'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('table', { name: 'Release asset downloads data' })).toHaveTextContent(
        'Unavailable',
      );
    },
  );

  it.each(['partial', 'stale'] as const)(
    'labels %s release and briefing context while retaining available fields',
    (availability) => {
      const data = baseOverview();
      data.release = { ...data.release!, availability };
      data.briefing = { ...data.briefing, availability };
      render(<OverviewPanels result={result(data)} />);
      expect(
        screen.getByText(new RegExp(`${availability} release context`, 'i')),
      ).toBeInTheDocument();
      expect(screen.getByText('v1.2.3')).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`${availability} briefing context`, 'i')),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Evidence was assembled for this completed review window.'),
      ).toBeInTheDocument();
    },
  );

  it.each(['partial', 'stale'] as const)(
    'labels unavailable retained fields for %s release and briefing context',
    (availability) => {
      const data = baseOverview();
      data.release = {
        availability,
        tagName: null,
        name: null,
        publishedAt: null,
        evidenceUrl: null,
        assetDownloads: null,
        provenanceRefs: [],
      };
      data.briefing = {
        availability,
        summary: null,
        generatedAt: null,
        evidenceUrl: null,
        provenanceRefs: [],
      };
      render(<OverviewPanels result={result(data)} />);
      expect(screen.getByText('Release tag unavailable')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('Briefing summary unavailable')).toBeInTheDocument();
      expect(screen.getByText('Generated date unknown')).toBeInTheDocument();
      expect(screen.queryByText('No release in this period')).not.toBeInTheDocument();
      expect(screen.queryByText('No briefing for this period')).not.toBeInTheDocument();
    },
  );

  it('renders no-release, no-briefing, and unsupported-attention states without inventing records', () => {
    const data = baseOverview();
    data.release = {
      availability: 'empty',
      tagName: null,
      name: null,
      publishedAt: null,
      evidenceUrl: null,
      assetDownloads: null,
      provenanceRefs: [],
    };
    data.briefing = {
      availability: 'empty',
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: [],
    };
    data.attention = [];
    render(<OverviewPanels result={result(data)} />);
    expect(screen.getByText('No release in this period')).toBeInTheDocument();
    expect(screen.getByText('No briefing for this period')).toBeInTheDocument();
    expect(screen.getByText('No current source exceptions')).toBeInTheDocument();
    expect(screen.queryByText(/issue action|pull request|check run/i)).not.toBeInTheDocument();
  });

  it('distinguishes failed release and briefing context from confirmed absence', () => {
    const data = baseOverview();
    data.release = {
      availability: 'failed',
      tagName: null,
      name: null,
      publishedAt: null,
      evidenceUrl: null,
      assetDownloads: null,
      provenanceRefs: [],
    };
    data.briefing = {
      availability: 'failed',
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: [],
    };
    render(<OverviewPanels result={result(data)} />);
    expect(screen.getByText('Release unavailable')).toBeInTheDocument();
    expect(screen.getByText('Briefing unavailable')).toBeInTheDocument();
    expect(
      screen.queryByText(/No (release|briefing) (in|for) this period/),
    ).not.toBeInTheDocument();
  });

  it('renders only actual source exceptions', () => {
    const data = baseOverview();
    data.attention = [
      {
        kind: 'source_failure',
        sourceKey: 'github',
        severity: 'critical',
        title: 'GitHub collection failed',
        detail: 'The latest source run did not complete.',
        detectedAt: at,
        evidenceUrl: null,
        provenanceRefs: [],
      },
    ];
    render(<OverviewPanels result={result(data)} />);
    expect(screen.getByText('GitHub collection failed')).toBeInTheDocument();
    expect(screen.getByText('The latest source run did not complete.')).toBeInTheDocument();
  });

  it('shows a safe page-level state for an invalid API response', () => {
    render(
      <OverviewPanels
        result={{ ok: false, kind: 'invalid-response', message: 'Overview data is unavailable.' }}
      />,
    );
    expect(screen.getByText('Overview unavailable')).toBeInTheDocument();
    expect(screen.queryByText('120')).not.toBeInTheDocument();
  });

  it('opens a focusable bounded evidence sheet with labelled safe external links', async () => {
    const user = userEvent.setup();
    const { container } = render(<OverviewPanels result={result(baseOverview())} />);
    await user.click(screen.getByRole('button', { name: 'Review evidence' }));
    const dialog = screen.getByRole('dialog', { name: 'Evidence and provenance' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close evidence' })).toHaveFocus();
    const link = within(dialog).getByRole('link', {
      name: /Open observation:1 evidence on api.github.com \(opens in a new tab\)/,
    });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.getAttribute('href')).not.toMatch(/[?#]/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
