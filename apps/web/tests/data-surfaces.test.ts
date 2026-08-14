import { describe, expect, it } from 'vitest';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';

import {
  selectDeliverySources,
  selectExecutivePulse,
  selectMetricChange,
  selectReachAcquisition,
} from '../lib/data-surfaces';

const ref = (name: string) => ({
  ref: name,
  sourceKey: 'github',
  observedAt: '2026-08-10T00:01:00.000Z',
  evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay',
});

const change = (
  metricKey: OverviewReadModelV1['changes'][number]['metricKey'],
  current: number,
  previous: number,
): OverviewReadModelV1['changes'][number] => ({
  metricKey,
  label: metricKey,
  unit:
    metricKey === 'github.views'
      ? 'views'
      : metricKey === 'github.clones'
        ? 'clones'
        : metricKey === 'github.release_asset_downloads'
          ? 'downloads'
          : 'count',
  availability: 'complete',
  current,
  previous,
  delta: current - previous,
  evidenceUrl: 'https://github.com/Codename-11/hermes-relay',
  provenanceRefs: [`metric:${metricKey}`],
});

const makeOverview = (): OverviewReadModelV1 => {
  const changes = [
    change('github.stars', 120, 100),
    change('github.views', 300, 200),
    change('github.clones', 30, 20),
    change('github.release_asset_downloads', 12, 8),
    change('github.open_issues', 7, 9),
  ];
  const referenceNames = changes.map((item) => item.provenanceRefs[0]!);

  return {
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
    changes,
    trend: {
      metricKey: 'github.release_asset_downloads',
      label: 'Release asset downloads',
      unit: 'downloads',
      availability: 'complete',
      points: [
        {
          timestamp: '2026-08-04T00:00:00.000Z',
          availability: 'complete',
          value: 3,
          provenanceRefs: ['trend:1'],
        },
        {
          timestamp: '2026-08-05T00:00:00.000Z',
          availability: 'complete',
          value: 9,
          provenanceRefs: ['trend:2'],
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
      assetDownloads: 12,
      provenanceRefs: ['release:1'],
    },
    briefing: {
      availability: 'complete',
      summary: 'Observed activity for the fixed seven-day window.',
      generatedAt: '2026-08-10T00:03:00.000Z',
      evidenceUrl: null,
      provenanceRefs: ['briefing:1'],
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
        provenanceRefs: ['source:1'],
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
        ...referenceNames.map(ref),
        ref('trend:1'),
        ref('trend:2'),
        ref('release:1'),
        ref('briefing:1'),
        ref('source:1'),
      ],
    },
  };
};

const unavailableChange = (
  availability: 'failed' | 'empty',
  metricKey: 'github.views' | 'github.clones',
): OverviewReadModelV1['changes'][number] => ({
  metricKey,
  label: metricKey,
  unit: metricKey === 'github.views' ? 'views' : 'clones',
  availability,
  current: null,
  previous: null,
  delta: null,
  evidenceUrl: null,
  provenanceRefs: [],
});

describe('honest data-surface selectors', () => {
  it('selects complete executive, reach, and delivery facts with evidence', () => {
    const overview = makeOverview();
    const pulse = selectExecutivePulse(overview);
    const reach = selectReachAcquisition(overview);
    const delivery = selectDeliverySources(overview);

    expect(pulse.stars?.change.current).toBe(120);
    expect(pulse.stars?.comparison).toEqual({ delta: 20, percent: 20, direction: 'increase' });
    expect(pulse.stars?.provenance[0]?.ref).toBe('metric:github.stars');
    expect(pulse.openIssues?.comparison?.direction).toBe('decrease');
    expect(pulse.freshness.lag).toEqual({
      availability: 'complete',
      label: 'Lag from last successful collection to freshness check',
      milliseconds: 240_000,
    });

    expect(reach.views?.change.current).toBe(300);
    expect(reach.clones?.change.current).toBe(30);
    expect(reach.stars?.change.current).toBe(120);
    expect(delivery.releaseDownloads?.change.current).toBe(12);
    expect(delivery.observedTrendTotal).toEqual({
      availability: 'complete',
      label: 'Total observed release asset downloads across trend intervals',
      value: 12,
      provenanceRefs: ['trend:1', 'trend:2'],
      provenance: [ref('trend:1'), ref('trend:2')],
    });
    expect(delivery.release?.assetDownloads).toBe(12);
    expect(delivery.sources[0]?.provenance[0]?.ref).toBe('source:1');
  });

  it('preserves partial nulls and does not fabricate comparisons or totals', () => {
    const overview = makeOverview();
    overview.availability = 'partial';
    overview.changes[1] = {
      ...overview.changes[1]!,
      availability: 'partial',
      current: null,
      previous: 200,
      delta: null,
    };
    overview.trend.availability = 'partial';
    overview.trend.points[1] = {
      ...overview.trend.points[1]!,
      availability: 'partial',
      value: null,
    };

    const reach = selectReachAcquisition(overview);
    const delivery = selectDeliverySources(overview);

    expect(reach.availability).toBe('partial');
    expect(reach.views?.change.current).toBeNull();
    expect(reach.views?.comparison).toBeNull();
    expect(delivery.trend.points[1]?.value).toBeNull();
    expect(delivery.observedTrendTotal).toMatchObject({ availability: 'partial', value: null });
  });

  it('does not calculate percent change when previous is zero', () => {
    const overview = makeOverview();
    overview.changes[0] = change('github.stars', 4, 0);

    expect(selectExecutivePulse(overview).stars?.comparison).toEqual({
      delta: 4,
      percent: null,
      direction: 'increase',
    });
  });

  it('returns null for a missing exact metric rather than a synthetic zero', () => {
    const overview = makeOverview();
    overview.changes = overview.changes.filter(({ metricKey }) => metricKey !== 'github.clones');

    expect(selectMetricChange(overview, 'github.clones')).toBeNull();
    expect(selectReachAcquisition(overview).clones).toBeNull();
  });

  it.each(['stale', 'failed', 'empty'] as const)(
    'preserves %s availability and nullable values without fallback numbers',
    (availability) => {
      const overview = makeOverview();
      overview.availability = availability;
      overview.freshness = {
        availability,
        checkedAt: overview.freshness.checkedAt,
        lastSuccessfulAt: null,
        staleAfter: null,
      };
      overview.changes[1] =
        availability === 'stale'
          ? {
              ...overview.changes[1]!,
              availability,
              current: null,
              previous: null,
              delta: null,
            }
          : unavailableChange(availability, 'github.views');

      const pulse = selectExecutivePulse(overview);
      const reach = selectReachAcquisition(overview);

      expect(pulse.availability).toBe(availability);
      expect(pulse.freshness.availability).toBe(availability);
      expect(pulse.freshness.lag).toEqual({
        availability,
        label: 'Lag from last successful collection to freshness check',
        milliseconds: null,
      });
      expect(reach.views?.change.availability).toBe(availability);
      expect(reach.views?.change.current).toBeNull();
      expect(reach.views?.comparison).toBeNull();
    },
  );

  it('retains failed and empty discriminants across delivery facts', () => {
    const overview = makeOverview();
    overview.release = {
      availability: 'failed',
      tagName: null,
      name: null,
      publishedAt: null,
      evidenceUrl: null,
      assetDownloads: null,
      provenanceRefs: [],
    };
    overview.trend.availability = 'empty';
    overview.trend.points = [];
    overview.sources[0] = {
      ...overview.sources[0]!,
      availability: 'failed',
      lastSuccessfulAt: null,
    };

    const delivery = selectDeliverySources(overview);

    expect(delivery.release?.availability).toBe('failed');
    expect(delivery.release?.assetDownloads).toBeNull();
    expect(delivery.observedTrendTotal).toMatchObject({ availability: 'empty', value: null });
    expect(delivery.sources[0]?.source.availability).toBe('failed');
    expect(JSON.stringify(delivery)).not.toContain('conversion');
    expect(JSON.stringify(delivery)).not.toContain('attribution');
  });

  it('does not total retained points when the trend is failed', () => {
    const overview = makeOverview();
    overview.trend.availability = 'failed';

    expect(selectDeliverySources(overview).observedTrendTotal).toMatchObject({
      availability: 'failed',
      value: null,
      provenanceRefs: [],
    });
  });
});
