import type {
  HistoricalContextReadModelV1,
  HistoricalContextSeriesV1,
  OverviewChangeV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';

import { selectMetricChange, type ChangeComparison } from './data-surfaces';

export type ReachMetricKey = HistoricalContextSeriesV1['metricKey'];
export type MetricEvidenceKind =
  'observed' | 'reconstructed' | 'lower-bound' | 'partial' | 'stale' | 'unavailable';

export interface ReachMetricDefinition {
  key: ReachMetricKey;
  label: string;
  shortLabel: string;
  description: string;
  evidenceFocus: 'current' | 'history';
}

export interface ReachMetricModel extends ReachMetricDefinition {
  change: OverviewChangeV1 | null;
  history: HistoricalContextSeriesV1 | null;
  historyAsOf: string | null;
  value: number | null;
  previous: number | null;
  comparison: ChangeComparison | null;
  coverageLabel: string;
  currentEvidenceKind: MetricEvidenceKind;
  historyEvidenceKind: MetricEvidenceKind;
  summaryEvidenceKind: MetricEvidenceKind;
  evidenceUrl: string | null;
  limitation: string | null;
}

export const reachMetricDefinitions = [
  {
    key: 'github.stars',
    label: 'Stars',
    shortLabel: 'Stars',
    description: 'Current repository stars and recoverable star history.',
    evidenceFocus: 'current',
  },
  {
    key: 'github.open_issues',
    label: 'Open issues',
    shortLabel: 'Open issues',
    description: 'Current open issues with best-effort lifecycle reconstruction.',
    evidenceFocus: 'history',
  },
  {
    key: 'github.views',
    label: 'Page views',
    shortLabel: 'Views',
    description: 'Directly observed GitHub repository page views.',
    evidenceFocus: 'current',
  },
  {
    key: 'github.clones',
    label: 'Repository clones',
    shortLabel: 'Clones',
    description: 'Directly observed GitHub repository clone activity.',
    evidenceFocus: 'current',
  },
] as const satisfies readonly ReachMetricDefinition[];

const currentEvidenceKind = (change: OverviewChangeV1 | null): MetricEvidenceKind => {
  if (change === null || change.current === null) return 'unavailable';
  if (change.availability === 'complete') return 'observed';
  if (change.availability === 'partial') return 'partial';
  if (change.availability === 'stale') return 'stale';
  return 'unavailable';
};

const coverageLabel = (change: OverviewChangeV1 | null): string => {
  if (change === null || change.current === null) return 'Unavailable';
  if (change.coverage) {
    return `${change.coverage.currentObservedDays}/${change.coverage.requiredDays} days`;
  }
  return 'Latest snapshot';
};

export const buildReachMetricModels = (
  overview: OverviewReadModelV1,
  history: HistoricalContextReadModelV1 | null,
): ReachMetricModel[] =>
  reachMetricDefinitions.map((definition) => {
    const selection = selectMetricChange(overview, definition.key);
    const change = selection?.change ?? null;
    const series = history?.series.find(({ metricKey }) => metricKey === definition.key) ?? null;
    const currentKind = currentEvidenceKind(change);
    const historyKind = series?.method ?? 'unavailable';
    const latestHistoryPoint = series?.points.filter(({ value }) => value !== null).at(-1);
    const historyDescribesCurrent =
      definition.evidenceFocus === 'history' &&
      latestHistoryPoint !== undefined &&
      latestHistoryPoint.timestamp === history?.asOf &&
      latestHistoryPoint.value === change?.current;

    return {
      ...definition,
      change,
      history: series,
      historyAsOf: history?.asOf ?? null,
      value: change?.current ?? null,
      previous: change?.previous ?? null,
      comparison: selection?.comparison ?? null,
      coverageLabel: historyDescribesCurrent ? 'Latest reconstruction' : coverageLabel(change),
      currentEvidenceKind: currentKind,
      historyEvidenceKind: historyKind,
      summaryEvidenceKind: historyDescribesCurrent ? historyKind : currentKind,
      evidenceUrl: change?.evidenceUrl ?? series?.evidenceUrl ?? null,
      limitation: series?.limitation ?? null,
    };
  });
