import type {
  HistoricalContextReadModelV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('renders the compact executive workspace with one heading and exact model facts', () => {
    const overview = overviewFixture();
    overview.attention = [];
    overview.changes = overview.changes.map((change) =>
      change.metricKey === 'github.views' || change.metricKey === 'github.clones'
        ? {
            ...change,
            coverage: {
              currentObservedDays: 7,
              previousObservedDays: 7,
              requiredDays: 7 as const,
            },
          }
        : change,
    );
    render(<ExecutivePulseSurface overview={overview} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Executive pulse' })).toBeInTheDocument();
    expect(
      screen.getByText('Operating state, material changes, and evidence requiring attention.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Evidence ready · collection healthy')).toBeInTheDocument();
    const factGrid = screen.getByRole('region', { name: 'Executive pulse facts' });
    expect(screen.getAllByRole('region', { name: / fact$/i })).toHaveLength(4);
    expect(factGrid.querySelector('.magic-number-ticker, [class*="motion"]')).toBeNull();

    const stars = screen.getByRole('region', { name: 'Stars fact' });
    const starsValue = stars.querySelector('.executive-pulse__fact-value');
    expect(starsValue).toHaveTextContent(/^120 count$/);
    expect(starsValue?.querySelector('.executive-pulse__fact-number')).toHaveTextContent('120');
    expect(starsValue?.querySelector('.executive-pulse__fact-unit')).toHaveTextContent('count');
    expect(stars).toHaveTextContent('Prior 115 · change +5.');
    const issues = screen.getByRole('region', { name: 'Open issues fact' });
    expect(issues.querySelector('.executive-pulse__fact-value')).toHaveTextContent(/^8 count$/);
    expect(
      issues.querySelector('.executive-pulse__fact-value .executive-pulse__fact-number'),
    ).toHaveTextContent('8');
    expect(issues).toHaveTextContent('Prior 10 · change -2.');
    const traffic = screen.getByRole('region', { name: 'Traffic coverage fact' });
    expect(traffic.querySelector('.executive-pulse__fact-value')).toHaveTextContent(/^7\/7 days$/);
    expect(traffic.querySelector('.executive-pulse__fact-number')).toHaveTextContent('7/7');
    expect(traffic).toHaveTextContent('7/7 observed days');
    const freshness = screen.getByRole('region', { name: 'Collection freshness fact' });
    expect(freshness.querySelector('.executive-pulse__fact-value')).toHaveTextContent(/^4 min$/);
    expect(freshness.querySelector('.executive-pulse__fact-number')).toHaveTextContent('4');
    expect(freshness.querySelector('.executive-pulse__fact-unit')).toHaveTextContent('min');
    expect(freshness).not.toHaveTextContent(/240,000|milliseconds/i);

    const window = screen.getByText(/Completed reporting window · 3 Aug 2026–10 Aug 2026 UTC/i);
    expect(window).toHaveClass('reach-command__window');
    expect(window).toBeVisible();

    const decisionBrief = screen
      .getByRole('heading', { name: 'Decision brief' })
      .closest('section,article,div');
    expect(decisionBrief).not.toBeNull();
    for (const label of ['Changed', 'Known', 'Limited', 'Action']) {
      expect(screen.getByText(label, { selector: 'dt' })).toBeInTheDocument();
    }
    expect(
      screen.getByText('Evidence was assembled for this completed review window.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No evidence limitations require attention.')).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evidence health' })).toBeInTheDocument();
    const evidenceActions = screen
      .getByRole('heading', { name: 'Evidence actions' })
      .closest('section');
    expect(evidenceActions).not.toBeNull();
    expect(within(evidenceActions!).getByText('No evidence action required.')).toBeInTheDocument();
    expect(within(evidenceActions!).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Available')).toHaveLength(2);
    expect(screen.queryByLabelText(/Available:\s*Complete/i)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(forbidden);
    expect(document.body).not.toHaveTextContent(/github\./i);
  });

  it.each([
    {
      accessibleLabel: '4 minutes',
      compactValue: '4 min',
      lastSuccessfulAt: '2026-08-10T00:00:59.999Z',
    },
    {
      accessibleLabel: '3.4 hours',
      compactValue: '3.4 hr',
      lastSuccessfulAt: '2026-08-09T20:38:08.900Z',
    },
  ])(
    'renders non-aligned collection freshness as static $compactValue',
    ({ accessibleLabel, compactValue, lastSuccessfulAt }) => {
      const overview = overviewFixture();
      overview.freshness = { ...overview.freshness, lastSuccessfulAt };

      render(<ExecutivePulseSurface overview={overview} />);

      const freshness = screen.getByRole('region', { name: 'Collection freshness fact' });
      const freshnessValue = freshness.querySelector('.executive-pulse__fact-value');
      expect(freshnessValue).toHaveTextContent(new RegExp(`^${compactValue}$`));
      expect(within(freshness).getByLabelText(accessibleLabel)).toBeInTheDocument();
      expect(freshnessValue).not.toHaveTextContent(/sec|milliseconds/i);
      expect(freshnessValue?.querySelector('.magic-number-ticker, [class*="motion"]')).toBeNull();
    },
  );

  it('renders reach values as independent aggregate repository signals with an exact table', () => {
    render(<ReachAcquisitionSurface overview={overviewFixture()} />);

    expect(screen.getByRole('heading', { name: 'Reach & acquisition' })).toBeInTheDocument();
    expect(screen.getByText(/3 Aug 2026–10 Aug 2026 UTC, end exclusive/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Completed week' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review evidence' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /metric, current/i })).toHaveLength(4);
    const table = screen.getByRole('table', {
      name: 'Exact current-window repository signal values',
    });
    expect(
      within(table).getByRole('row', { name: 'Page views 60 50 Latest snapshot' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: 'Repository clones 22 20 Latest snapshot' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: 'Stars 120 115 Latest snapshot' }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(forbidden);
  });

  it('renders best-effort history with exact endpoints and explicit limitations', async () => {
    const user = userEvent.setup();
    const fixture = overviewFixture();
    const history: HistoricalContextReadModelV1 = {
      version: 1 as const,
      project: fixture.project,
      period: '180d' as const,
      window: {
        start: '2026-04-01T00:00:00.000Z',
        end: '2026-08-10T00:00:00.000Z',
      },
      asOf: '2026-08-10T00:00:00.000Z',
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
              availability: 'partial',
              value: 1,
              provenanceRefs: [],
            },
            {
              timestamp: '2026-08-10T00:00:00.000Z',
              availability: 'partial',
              value: 118,
              provenanceRefs: [],
            },
          ],
        },
      ],
      provenance: {
        scope: 'Codename-11/hermes-relay' as const,
        generatedAt: '2026-08-10T00:00:00.000Z',
        references: [],
      },
    };
    render(<ReachAcquisitionSurface overview={fixture} history={history} />);

    expect(screen.getByRole('heading', { name: 'Signal history' })).toBeInTheDocument();
    expect(screen.getByLabelText('History range: six months')).toHaveTextContent('6 months');
    expect(screen.getAllByText('Lower-bound').length).toBeGreaterThan(0);
    expect(screen.getByText('People who later unstarred are absent.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Stars history.*1.*118/i })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /Stars metric/i }).querySelector('polyline'),
    ).toHaveAttribute('stroke-dasharray', '6 4');

    const starsTab = screen.getByRole('tab', { name: 'Stars' });
    const issuesTab = screen.getByRole('tab', { name: 'Open issues' });
    const clonesTab = screen.getByRole('tab', { name: 'Clones' });
    expect(starsTab).toHaveAttribute('tabindex', '0');
    expect(issuesTab).toHaveAttribute('tabindex', '-1');
    starsTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(issuesTab).toHaveFocus();
    expect(issuesTab).toHaveAttribute('aria-selected', 'true');
    expect(issuesTab).toHaveAttribute('tabindex', '0');
    await user.keyboard('{End}');
    expect(clonesTab).toHaveFocus();
    await user.keyboard('{Home}');
    expect(starsTab).toHaveFocus();

    const limitation = screen.getByText('People who later unstarred are absent.');
    const provenanceRow = limitation.closest('li');
    expect(provenanceRow).not.toBeNull();
    expect(within(provenanceRow as HTMLElement).getByText('Lower-bound')).toBeInTheDocument();
  });

  it('keeps seven-day signals visible when independent historical context fails', () => {
    render(<ReachAcquisitionSurface overview={overviewFixture()} history={null} />);
    expect(screen.getByRole('heading', { name: 'Signal history' })).toBeVisible();
    expect(screen.getByText('Historical values are unavailable.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Stars' })).toBeVisible();
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
    const views = screen.getByRole('region', { name: /Page views metric/i });
    expect(within(views).getByText('Coverage: 5/7 days')).toBeInTheDocument();
    expect(within(views).getByText('Comparison unavailable')).toBeInTheDocument();
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

  it('renders partial semantics, deduplicated attention, and the briefing fallback', () => {
    const overview = overviewFixture();
    overview.availability = 'partial';
    overview.freshness = { ...overview.freshness, availability: 'partial' };
    overview.changes = overview.changes.map((change) => {
      if (change.metricKey === 'github.stars') {
        return {
          ...change,
          availability: 'partial' as const,
          previous: null,
          delta: null,
        };
      }
      if (change.metricKey === 'github.views' || change.metricKey === 'github.clones') {
        return {
          ...change,
          availability: 'partial' as const,
          delta: null,
          coverage: {
            currentObservedDays: change.metricKey === 'github.views' ? 5 : 6,
            previousObservedDays: 7,
            requiredDays: 7 as const,
          },
        };
      }
      if (change.metricKey === 'github.release_asset_downloads') {
        return {
          ...change,
          availability: 'partial' as const,
          previous: null,
          delta: null,
        };
      }
      return change;
    });
    overview.briefing = {
      availability: 'partial',
      summary: null,
      generatedAt: null,
      evidenceUrl: null,
      provenanceRefs: [],
    };

    render(<ExecutivePulseSurface overview={overview} />);

    expect(screen.getByText('Partial evidence · collection partial')).toBeInTheDocument();
    const stars = screen.getByRole('region', { name: 'Stars fact' });
    expect(stars.querySelector('.executive-pulse__fact-number')).toHaveTextContent('120');
    expect(stars).toHaveTextContent('Exact prior-period comparison unavailable.');
    const attention = screen.getByRole('heading', { name: 'Needs attention' }).closest('section');
    expect(attention).not.toBeNull();
    expect(within(attention!).getByText('4 items')).toBeInTheDocument();
    expect(within(attention!).getAllByRole('listitem')).toHaveLength(4);
    for (const label of ['Stars', 'Views', 'Clones', 'Release asset downloads']) {
      expect(within(attention!).getAllByText(label, { selector: 'strong' })).toHaveLength(1);
    }
    const evidenceActions = screen
      .getByRole('heading', { name: 'Evidence actions' })
      .closest('section');
    expect(evidenceActions).not.toBeNull();
    expect(evidenceActions).toHaveTextContent(
      'Review incomplete collection evidence before acting on completed-window evidence.',
    );
    expect(within(evidenceActions!).getAllByRole('link')).toHaveLength(2);
    expect(
      within(evidenceActions!).getByRole('link', { name: /Inspect Stars evidence/i }),
    ).toHaveAttribute('href', 'https://github.com/Codename-11/hermes-relay/stargazers');
    expect(
      within(evidenceActions!).getByRole('link', {
        name: /Inspect Release asset downloads evidence/i,
      }),
    ).toHaveAttribute('href', 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3');
    expect(
      within(evidenceActions!).queryByText('Exact prior-period comparison unavailable.'),
    ).toBeNull();
    expect(screen.getAllByLabelText('Partial')).toHaveLength(2);
    expect(screen.queryByLabelText(/Partial:\s*Partial/i)).not.toBeInTheDocument();
    expect(screen.getByText('Authored briefing unavailable for this window.')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/github\./i);
  });

  it('renders unavailable evidence without a healthy collection claim or green freshness dot', () => {
    const overview = overviewFixture();
    overview.availability = 'empty';
    overview.freshness = {
      availability: 'empty',
      checkedAt: at,
      lastSuccessfulAt: null,
      staleAfter: null,
    };
    overview.changes[0] = {
      ...overview.changes[0]!,
      availability: 'empty',
      current: null,
      previous: null,
      delta: null,
    };

    const { container } = render(<ExecutivePulseSurface overview={overview} />);

    expect(screen.getByText('Evidence unavailable · collection unavailable')).toBeInTheDocument();
    expect(screen.getByText('No successful collection')).toBeInTheDocument();
    expect(container.querySelector('.reach-command__freshness > span')).not.toBeInTheDocument();
    const stars = screen.getByRole('region', { name: 'Stars fact' });
    const unavailableValue = within(stars).getByText('Unavailable');
    expect(unavailableValue).toHaveClass(
      'executive-pulse__fact-value',
      'executive-pulse__fact-value--unavailable',
    );
    expect(stars.querySelector('.magic-number-ticker, [class*="motion"]')).toBeNull();
    expect(stars).toHaveTextContent('Current value and exact comparison unavailable.');
    expect(screen.getByText('2 items')).toBeInTheDocument();
    const health = screen.getByRole('heading', { name: 'Evidence health' }).closest('section');
    expect(health).not.toBeNull();
    expect(within(health!).getAllByText(/unavailable/i).length).toBeGreaterThan(0);
    expect(health).not.toHaveTextContent('Healthy');
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
    expect(executive.container).toHaveTextContent('No successful collection');
    expect(executive.container).toHaveTextContent(
      'No successful collection checkpoint is available.',
    );
    expect(executive.container).not.toHaveTextContent('Unavailable UTC');
    expect(executive.container.querySelector('.reach-command__freshness > span')).toBeNull();
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
