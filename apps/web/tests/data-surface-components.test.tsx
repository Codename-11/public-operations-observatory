import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import { DeliverySourcesSurface } from '../components/data-surfaces/delivery-sources-surface';
import { DataSurfaceResult } from '../components/data-surfaces/data-surface-result';
import { ExecutivePulseSurface } from '../components/data-surfaces/executive-pulse-surface';
import { ReachAcquisitionSurface } from '../components/data-surfaces/reach-acquisition-surface';

const at = '2026-08-10T00:05:00.000Z';

const overviewFixture = (): OverviewReadModelV1 => ({
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
      provenanceRefs: ['observation:repo'],
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
      provenanceRefs: ['observation:traffic'],
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
      provenanceRefs: ['observation:traffic'],
    },
    {
      metricKey: 'github.release_asset_downloads',
      label: 'Release asset downloads',
      unit: 'downloads',
      availability: 'complete',
      current: 31,
      previous: 21,
      delta: 10,
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
      provenanceRefs: ['observation:release'],
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
      provenanceRefs: ['observation:repo'],
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
        provenanceRefs: ['observation:release'],
      },
      {
        timestamp: '2026-08-05T00:00:00.000Z',
        value: 19,
        availability: 'complete',
        provenanceRefs: ['observation:release'],
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
    provenanceRefs: ['observation:release'],
  },
  briefing: {
    availability: 'complete',
    summary: 'Evidence was assembled for this completed review window.',
    generatedAt: '2026-08-10T00:03:00.000Z',
    evidenceUrl: null,
    provenanceRefs: ['observation:repo'],
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
      provenanceRefs: ['observation:repo'],
    },
  ],
  attention: [
    {
      kind: 'incomplete_metric_window',
      sourceKey: 'github',
      severity: 'warning',
      title: 'Traffic interval incomplete',
      detail: 'The current traffic interval has incomplete evidence.',
      detectedAt: at,
      evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay/traffic/views',
      provenanceRefs: ['observation:traffic'],
    },
  ],
  provenance: {
    scope: 'Codename-11/hermes-relay',
    metricDefinitionVersion: 1,
    windowEnd: '2026-08-10T00:00:00.000Z',
    asOf: at,
    generatedAt: at,
    references: [
      {
        ref: 'observation:repo',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay',
      },
      {
        ref: 'observation:traffic',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay/traffic/views',
      },
      {
        ref: 'observation:release',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay/releases',
      },
    ],
  },
});

const forbidden = /conversion|attribution|unique visitors|weighted attention|caused|adoption/i;

const expectWindowAndEvidence = () => {
  expect(screen.getByText(/3 Aug 2026–10 Aug 2026 UTC, end exclusive/i)).toBeInTheDocument();
  expect(
    screen.getByText(/Completed reporting window.*compared with 27 Jul 2026–3 Aug 2026 UTC/i),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Completed week' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('button', { name: 'Refresh now' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review evidence' })).toBeInTheDocument();
};

describe('production data surfaces', () => {
  it('renders the executive decision layer with exact values and honest context', () => {
    render(<ExecutivePulseSurface overview={overviewFixture()} />);

    expectWindowAndEvidence();
    const stars = screen.getByLabelText('Stars metric');
    expect(within(stars).getByLabelText('120')).toBeInTheDocument();
    expect(within(stars).getByText('115')).toBeInTheDocument();
    expect(within(stars).getByText('+5')).toBeInTheDocument();
    const issues = screen.getByLabelText('Open issues metric');
    expect(within(issues).getByLabelText('8')).toBeInTheDocument();
    expect(within(issues).getByText('10')).toBeInTheDocument();
    expect(within(issues).getByText('-2')).toBeInTheDocument();
    expect(
      screen.getByText('Evidence was assembled for this completed review window.'),
    ).toBeInTheDocument();
    expect(screen.getByText('4 minutes')).toBeInTheDocument();
    expect(screen.getByText('Traffic interval incomplete')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(forbidden);
  });

  it('renders reach values as independent aggregate repository signals with an exact table', () => {
    render(<ReachAcquisitionSurface overview={overviewFixture()} />);

    expectWindowAndEvidence();
    expect(screen.getAllByText('Independent aggregate repository signals').length).toBeGreaterThan(
      0,
    );
    const table = screen.getByRole('table', {
      name: 'Exact independent aggregate repository signal values',
    });
    expect(
      within(table).getByRole('row', { name: 'Views views 60 50 +10 complete' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: 'Clones clones 22 20 +2 complete' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: 'Stars count 120 115 +5 complete' }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(forbidden);
  });

  it('labels the current observation view and reports observed traffic coverage', () => {
    const fixture = overviewFixture();
    const changes = fixture.changes.map((change) =>
      change.metricKey === 'github.views'
        ? {
            ...change,
            availability: 'partial' as const,
            delta: null,
            coverage: {
              currentObservedDays: 5,
              previousObservedDays: 7,
              requiredDays: 7 as const,
            },
          }
        : change,
    );
    render(<ReachAcquisitionSurface overview={{ ...fixture, view: 'current', changes }} />);

    expect(screen.getByText(/Current observation window/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Current' })).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByText('Observed coverage: 5/7 current days · 7/7 prior days.'),
    ).toBeInTheDocument();
  });

  it('renders delivery context, exact observed points, total, source state, and attention', () => {
    render(<DeliverySourcesSurface overview={overviewFixture()} />);

    expectWindowAndEvidence();
    expect(screen.getByRole('heading', { name: 'v1.2.3' })).toBeInTheDocument();
    expect(screen.getByText('Hermes-Relay v1.2.3')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Release asset downloads data' })).toBeInTheDocument();
    const heroValue = document.querySelector('.data-surface-hero__value');
    expect(heroValue).toHaveTextContent('31downloads');
    expect(
      within(screen.getByLabelText('Observed interval total')).getByLabelText('31'),
    ).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Traffic interval incomplete')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(forbidden);
  });

  it('preserves partial values and labels unavailable fields instead of filling them', () => {
    const overview = overviewFixture();
    overview.availability = 'partial';
    overview.changes = overview.changes.map((change) =>
      change.metricKey === 'github.stars'
        ? {
            ...change,
            availability: 'partial' as const,
            current: 120,
            previous: null,
            delta: null,
          }
        : change,
    );
    overview.briefing = {
      availability: 'partial',
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: [],
    };

    render(<ExecutivePulseSurface overview={overview} />);

    expect(screen.getByText('Partial overview')).toBeInTheDocument();
    const stars = screen.getByLabelText('Stars metric');
    expect(within(stars).getByLabelText('120')).toBeInTheDocument();
    expect(within(stars).getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.getByText('Briefing summary unavailable')).toBeInTheDocument();
  });

  it('does not provide an observed total when any interval is unavailable', () => {
    const overview = overviewFixture();
    overview.availability = 'partial';
    overview.trend = {
      ...overview.trend,
      availability: 'partial',
      points: [
        overview.trend.points[0]!,
        {
          timestamp: '2026-08-05T00:00:00.000Z',
          value: null,
          availability: 'partial',
          provenanceRefs: [],
        },
      ],
    };

    render(<DeliverySourcesSurface overview={overview} />);

    expect(screen.getByText('Observed total unavailable.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Release asset downloads data' });
    expect(within(table).getByText('12')).toBeInTheDocument();
    expect(within(table).getByText('Unavailable')).toBeInTheDocument();
  });

  it('does not label unavailable timestamps as UTC values', () => {
    const overview = overviewFixture();
    overview.freshness = {
      ...overview.freshness,
      lastSuccessfulAt: null,
      staleAfter: null,
    };
    overview.sources = overview.sources.map((source) => ({
      ...source,
      lastAttemptAt: null,
      lastSuccessfulAt: null,
    }));

    const executive = render(<ExecutivePulseSurface overview={overview} />);
    expect(executive.container).toHaveTextContent('Last successfulUnavailable');
    expect(executive.container).not.toHaveTextContent('Unavailable UTC');
    executive.unmount();

    const delivery = render(<DeliverySourcesSurface overview={overview} />);
    expect(delivery.container).toHaveTextContent('Last attempt Unavailable');
    expect(delivery.container).not.toHaveTextContent('Unavailable UTC');
  });

  it('retains the surface heading and project context when the Overview API is unavailable', () => {
    render(
      <DataSurfaceResult
        result={{
          ok: false,
          kind: 'network',
          message: 'The public overview could not be loaded.',
        }}
        surface={ExecutivePulseSurface}
        eyebrow="Executive pulse"
        heading="Hermes-Relay decision layer"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Hermes-Relay decision layer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Overview unavailable')).toBeInTheDocument();
    expect(screen.getByText('Application navigation and project context')).toBeInTheDocument();
    expect(screen.getByText('The public overview could not be loaded.')).toBeInTheDocument();
  });

  it.each([
    ['Executive pulse', ExecutivePulseSurface],
    ['Reach and acquisition', ReachAcquisitionSurface],
    ['Delivery and sources', DeliverySourcesSurface],
  ] as const)('has no detectable axe violations for %s', async (_name, Surface) => {
    const { container } = render(
      <main>
        <Surface overview={overviewFixture()} />
      </main>,
    );
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});
