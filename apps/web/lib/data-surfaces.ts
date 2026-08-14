import type {
  OverviewAvailability,
  OverviewBriefingSummaryV1,
  OverviewChangeV1,
  OverviewFreshnessV1,
  OverviewProvenanceReferenceV1,
  OverviewReadModelV1,
  OverviewReleaseV1,
  OverviewSourceAttentionExceptionV1,
  OverviewSourceV1,
  OverviewTrendV1,
  OverviewWarningV1,
  OverviewWindowV1,
} from '@public-operations-observatory/contracts';

export type OverviewMetricKey = OverviewChangeV1['metricKey'];

export interface ChangeComparison {
  delta: number;
  /** Null when the previous value is zero, so no percentage is claimed. */
  percent: number | null;
  direction: 'increase' | 'decrease' | 'unchanged';
}

export interface MetricChangeSelection {
  change: OverviewChangeV1;
  comparison: ChangeComparison | null;
  provenance: OverviewProvenanceReferenceV1[];
}

export interface FreshnessLagSelection {
  availability: OverviewAvailability;
  label: 'Lag from last successful collection to freshness check';
  milliseconds: number | null;
}

export interface FreshnessSelection {
  availability: OverviewAvailability;
  freshness: OverviewFreshnessV1;
  lag: FreshnessLagSelection;
}

interface SurfaceContext {
  availability: OverviewAvailability;
  period: OverviewReadModelV1['period'];
  window: OverviewWindowV1;
  asOf: string;
}

export interface ExecutivePulseSelection extends SurfaceContext {
  stars: MetricChangeSelection | null;
  openIssues: MetricChangeSelection | null;
  freshness: FreshnessSelection;
  briefing: {
    briefing: OverviewBriefingSummaryV1;
    provenance: OverviewProvenanceReferenceV1[];
  };
  warnings: OverviewWarningV1[];
  attention: Array<{
    exception: OverviewSourceAttentionExceptionV1;
    provenance: OverviewProvenanceReferenceV1[];
  }>;
}

export interface ReachAcquisitionSelection extends SurfaceContext {
  /** Raw repository traffic observations; no visitor, funnel, or attribution claim is made. */
  views: MetricChangeSelection | null;
  clones: MetricChangeSelection | null;
  stars: MetricChangeSelection | null;
}

export interface ObservedTrendTotalSelection {
  availability: OverviewAvailability;
  label: 'Total observed release asset downloads across trend intervals';
  value: number | null;
  provenanceRefs: string[];
  provenance: OverviewProvenanceReferenceV1[];
}

export interface DeliverySourcesSelection extends SurfaceContext {
  releaseDownloads: MetricChangeSelection | null;
  trend: OverviewTrendV1;
  observedTrendTotal: ObservedTrendTotalSelection;
  release: (OverviewReleaseV1 & { provenance: OverviewProvenanceReferenceV1[] }) | null;
  sources: Array<{
    source: OverviewSourceV1;
    provenance: OverviewProvenanceReferenceV1[];
  }>;
  attention: Array<{
    exception: OverviewSourceAttentionExceptionV1;
    provenance: OverviewProvenanceReferenceV1[];
  }>;
}

const surfaceContext = (overview: OverviewReadModelV1): SurfaceContext => ({
  availability: overview.availability,
  period: overview.period,
  window: overview.window,
  asOf: overview.asOf,
});

const resolveProvenance = (
  overview: OverviewReadModelV1,
  refs: readonly string[],
): OverviewProvenanceReferenceV1[] => {
  const requested = new Set(refs);
  return overview.provenance.references.filter((reference) => requested.has(reference.ref));
};

const comparisonFor = (change: OverviewChangeV1): ChangeComparison | null => {
  if (change.current === null || change.previous === null || change.delta === null) {
    return null;
  }

  return {
    delta: change.delta,
    percent: change.previous > 0 ? (change.delta / change.previous) * 100 : null,
    direction: change.delta > 0 ? 'increase' : change.delta < 0 ? 'decrease' : 'unchanged',
  };
};

export const selectMetricChange = (
  overview: OverviewReadModelV1,
  metricKey: OverviewMetricKey,
): MetricChangeSelection | null => {
  const change = overview.changes.find((candidate) => candidate.metricKey === metricKey);
  if (change === undefined) return null;

  return {
    change,
    comparison: comparisonFor(change),
    provenance: resolveProvenance(overview, change.provenanceRefs),
  };
};

const selectFreshness = (overview: OverviewReadModelV1): FreshnessSelection => {
  const { freshness } = overview;
  const milliseconds =
    freshness.lastSuccessfulAt === null
      ? null
      : Date.parse(freshness.checkedAt) - Date.parse(freshness.lastSuccessfulAt);

  return {
    availability: freshness.availability,
    freshness,
    lag: {
      availability: freshness.availability,
      label: 'Lag from last successful collection to freshness check',
      milliseconds,
    },
  };
};

const selectAttention = (overview: OverviewReadModelV1) =>
  overview.attention.map((exception) => ({
    exception,
    provenance: resolveProvenance(overview, exception.provenanceRefs),
  }));

export const selectExecutivePulse = (overview: OverviewReadModelV1): ExecutivePulseSelection => ({
  ...surfaceContext(overview),
  stars: selectMetricChange(overview, 'github.stars'),
  openIssues: selectMetricChange(overview, 'github.open_issues'),
  freshness: selectFreshness(overview),
  briefing: {
    briefing: overview.briefing,
    provenance: resolveProvenance(overview, overview.briefing.provenanceRefs),
  },
  warnings: overview.warnings,
  attention: selectAttention(overview),
});

export const selectReachAcquisition = (
  overview: OverviewReadModelV1,
): ReachAcquisitionSelection => ({
  ...surfaceContext(overview),
  views: selectMetricChange(overview, 'github.views'),
  clones: selectMetricChange(overview, 'github.clones'),
  stars: selectMetricChange(overview, 'github.stars'),
});

const selectObservedTrendTotal = (overview: OverviewReadModelV1): ObservedTrendTotalSelection => {
  const points = overview.trend.points;
  const canTotal =
    overview.trend.availability !== 'failed' &&
    overview.trend.availability !== 'empty' &&
    points.length > 0 &&
    points.every((point) => point.value !== null);
  const provenanceRefs = canTotal
    ? [...new Set(points.flatMap((point) => point.provenanceRefs))]
    : [];

  return {
    availability: overview.trend.availability,
    label: 'Total observed release asset downloads across trend intervals',
    value: canTotal
      ? points.reduce<number>((total, point) => total + (point.value as number), 0)
      : null,
    provenanceRefs,
    provenance: resolveProvenance(overview, provenanceRefs),
  };
};

export const selectDeliverySources = (overview: OverviewReadModelV1): DeliverySourcesSelection => ({
  ...surfaceContext(overview),
  releaseDownloads: selectMetricChange(overview, 'github.release_asset_downloads'),
  trend: overview.trend,
  observedTrendTotal: selectObservedTrendTotal(overview),
  release:
    overview.release === null
      ? null
      : {
          ...overview.release,
          provenance: resolveProvenance(overview, overview.release.provenanceRefs),
        },
  sources: overview.sources.map((source) => ({
    source,
    provenance: resolveProvenance(overview, source.provenanceRefs),
  })),
  attention: selectAttention(overview),
});
