import type {
  HistoricalContextReadModelV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';
import { describe, expect, it } from 'vitest';

import { buildReachMetricModels, reachMetricDefinitions } from '../lib/reach-metric-registry';

const overview = {
  changes: [
    {
      metricKey: 'github.stars',
      label: 'Stars',
      unit: 'count',
      availability: 'partial',
      current: 132,
      previous: null,
      delta: null,
      evidenceUrl: 'https://github.com/Codename-11/hermes-relay/stargazers',
      provenanceRefs: [],
    },
    {
      metricKey: 'github.views',
      label: 'Page views',
      unit: 'views',
      availability: 'partial',
      current: 1125,
      previous: 589,
      delta: null,
      evidenceUrl: null,
      provenanceRefs: [],
      coverage: { currentObservedDays: 6, previousObservedDays: 7, requiredDays: 7 },
    },
  ],
  provenance: { references: [] },
} as unknown as OverviewReadModelV1;

const history = {
  asOf: '2026-08-01T00:00:00.000Z',
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
          timestamp: '2026-04-01T00:00:00.000Z',
          value: 1,
          availability: 'partial',
          provenanceRefs: [],
        },
        {
          timestamp: '2026-08-01T00:00:00.000Z',
          value: 132,
          availability: 'partial',
          provenanceRefs: [],
        },
      ],
    },
  ],
} as unknown as HistoricalContextReadModelV1;

describe('reach metric registry', () => {
  it('defines the dashboard order independently from source payload order', () => {
    expect(reachMetricDefinitions.map(({ key }) => key)).toEqual([
      'github.stars',
      'github.open_issues',
      'github.views',
      'github.clones',
    ]);
  });

  it('joins current and historical evidence by metric key without inventing missing values', () => {
    const models = buildReachMetricModels(overview, history);
    expect(models).toHaveLength(4);

    expect(models[0]).toMatchObject({
      key: 'github.stars',
      label: 'Stars',
      value: 132,
      previous: null,
      comparison: null,
      currentEvidenceKind: 'partial',
      historyEvidenceKind: 'lower-bound',
      historyAsOf: '2026-08-01T00:00:00.000Z',
      coverageLabel: 'Latest snapshot',
    });
    expect(models[0]?.history?.points).toHaveLength(2);

    expect(models[1]).toMatchObject({
      key: 'github.open_issues',
      value: null,
      previous: null,
      history: null,
      coverageLabel: 'Unavailable',
    });

    expect(models[2]).toMatchObject({
      key: 'github.views',
      value: 1125,
      previous: 589,
      comparison: null,
      currentEvidenceKind: 'partial',
      coverageLabel: '6/7 days',
    });
  });

  it('keeps historical failure independent from current metric values', () => {
    const models = buildReachMetricModels(overview, null);
    expect(models.find(({ key }) => key === 'github.stars')).toMatchObject({
      value: 132,
      history: null,
      historyEvidenceKind: 'unavailable',
    });
  });

  it('uses reconstructed summary evidence only when its endpoint describes the current value', () => {
    const openIssuesOverview = {
      ...overview,
      changes: [
        ...overview.changes,
        {
          metricKey: 'github.open_issues',
          label: 'Open issues',
          unit: 'count',
          availability: 'complete',
          current: 8,
          previous: 10,
          delta: -2,
          evidenceUrl: null,
          provenanceRefs: [],
        },
      ],
    } as unknown as OverviewReadModelV1;
    const series = {
      metricKey: 'github.open_issues',
      label: 'Open issues',
      unit: 'count',
      bucket: 'calendar-month-end',
      method: 'reconstructed',
      availability: 'partial',
      limitation: 'Best-effort lifecycle reconstruction.',
      reasonCode: 'reconstructed',
      evidenceUrl: null,
      points: [],
    } as const;
    const emptyHistory = {
      asOf: '2026-08-01T00:00:00.000Z',
      series: [series],
    } as unknown as HistoricalContextReadModelV1;

    expect(buildReachMetricModels(openIssuesOverview, emptyHistory)[1]).toMatchObject({
      value: 8,
      currentEvidenceKind: 'observed',
      summaryEvidenceKind: 'observed',
      coverageLabel: 'Latest snapshot',
    });

    const matchingHistory = {
      ...emptyHistory,
      series: [
        {
          ...series,
          points: [
            {
              timestamp: emptyHistory.asOf,
              value: 8,
              availability: 'partial',
              provenanceRefs: [],
            },
          ],
        },
      ],
    } as unknown as HistoricalContextReadModelV1;
    expect(buildReachMetricModels(openIssuesOverview, matchingHistory)[1]).toMatchObject({
      summaryEvidenceKind: 'reconstructed',
      coverageLabel: 'Latest reconstruction',
    });
  });
});
