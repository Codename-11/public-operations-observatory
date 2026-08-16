import type {
  OverviewAvailability,
  OverviewBriefingSummaryV1,
  OverviewChangeV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';

export interface PulseFact {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  detail: string;
  evidenceLabel: string;
  availability: OverviewAvailability;
  evidenceUrl: string | null;
}

export interface ExecutivePulseOperatingStatus {
  availability: OverviewAvailability;
  collectionHealthy: boolean;
  title: string;
  detail: string;
  incompleteMetricCount: number;
}

export interface ExecutivePulseDecisionRow {
  key: 'changed' | 'known' | 'limited' | 'action';
  label: string;
  text: string;
}

export interface ExecutivePulseAttentionItem {
  key: string;
  label: string;
  detail: string;
  availability: OverviewAvailability;
  evidenceUrl: string | null;
  severity: 'warning' | 'critical';
}

export interface ExecutivePulseEvidenceHealth {
  overall: OverviewAvailability;
  collection: 'healthy' | 'partial' | 'stale' | 'failed' | 'unavailable';
  trafficObservedDays: number | null;
  trafficRequiredDays: 7;
  freshnessLagMilliseconds: number | null;
  briefing: OverviewAvailability;
}

export interface ExecutivePulseModel {
  operatingStatus: ExecutivePulseOperatingStatus;
  facts: {
    stars: PulseFact;
    openIssues: PulseFact;
    trafficCoverage: PulseFact;
    freshness: PulseFact;
  };
  decisionRows: ExecutivePulseDecisionRow[];
  attentionItems: ExecutivePulseAttentionItem[];
  evidenceHealth: ExecutivePulseEvidenceHealth;
  authoredBriefing: OverviewBriefingSummaryV1;
}

type MetricKey = OverviewChangeV1['metricKey'];
type CollectionState = ExecutivePulseEvidenceHealth['collection'];

const metricAttentionKeys: Record<MetricKey, string> = {
  'github.stars': 'stars',
  'github.views': 'views',
  'github.clones': 'clones',
  'github.release_asset_downloads': 'release-asset-downloads',
  'github.open_issues': 'open-issues',
};

const signed = (value: number): string => (value >= 0 ? `+${value}` : String(value));

const exactComparison = (
  change: OverviewChangeV1 | undefined,
): change is OverviewChangeV1 & { current: number; previous: number; delta: number } =>
  change !== undefined &&
  change.current !== null &&
  change.previous !== null &&
  change.delta !== null;

const incompleteChange = (change: OverviewChangeV1): boolean =>
  change.availability !== 'complete' || !exactComparison(change);

const deduplicateChanges = (changes: OverviewChangeV1[]): OverviewChangeV1[] => {
  const seen = new Set<MetricKey>();
  return changes.filter(({ metricKey }) => {
    if (seen.has(metricKey)) return false;
    seen.add(metricKey);
    return true;
  });
};

const findChange = (changes: OverviewChangeV1[], key: MetricKey): OverviewChangeV1 | undefined =>
  changes.find(({ metricKey }) => metricKey === key);

const metricFact = (
  change: OverviewChangeV1 | undefined,
  fallback: { key: string; label: string; unit: string },
): PulseFact => {
  const label = change?.label ?? fallback.label;
  let detail: string;
  if (change === undefined || change.current === null) {
    detail = 'Current value and exact comparison unavailable.';
  } else if (exactComparison(change)) {
    detail = `Prior ${change.previous} · change ${signed(change.delta)}.`;
  } else {
    detail = 'Exact prior-period comparison unavailable.';
  }

  return {
    key: fallback.key,
    label,
    value: change?.current ?? null,
    unit: change?.unit ?? fallback.unit,
    detail,
    evidenceLabel: `${label} evidence`,
    availability: change?.availability ?? 'empty',
    evidenceUrl: change?.evidenceUrl ?? null,
  };
};

const availabilityRank: Record<OverviewAvailability, number> = {
  complete: 0,
  empty: 1,
  partial: 2,
  stale: 3,
  failed: 4,
};

const lessAvailable = (
  first: OverviewAvailability,
  second: OverviewAvailability,
): OverviewAvailability => (availabilityRank[first] >= availabilityRank[second] ? first : second);

const trafficCoverageFact = (
  views: OverviewChangeV1 | undefined,
  clones: OverviewChangeV1 | undefined,
): PulseFact => {
  const bothCoverageObjects = views?.coverage !== undefined && clones?.coverage !== undefined;
  const value = bothCoverageObjects
    ? Math.min(views.coverage!.currentObservedDays, clones.coverage!.currentObservedDays)
    : null;
  const requiredDays = bothCoverageObjects
    ? Math.max(views.coverage!.requiredDays, clones.coverage!.requiredDays)
    : 7;
  const sourceAvailability =
    views === undefined || clones === undefined || !bothCoverageObjects
      ? 'empty'
      : lessAvailable(views.availability, clones.availability);
  const availability =
    value !== null && value < requiredDays
      ? lessAvailable(sourceAvailability, 'partial')
      : sourceAvailability;

  return {
    key: 'traffic-coverage',
    label: 'Traffic coverage',
    value,
    unit: 'days',
    detail:
      value === null
        ? 'Current observed-day traffic coverage is unavailable because both traffic coverage records are required.'
        : `${value}/${requiredDays} observed days.`,
    evidenceLabel: 'Traffic coverage evidence',
    availability,
    evidenceUrl:
      views !== undefined && views.evidenceUrl !== null && views.evidenceUrl === clones?.evidenceUrl
        ? views.evidenceUrl
        : null,
  };
};

const effectiveCollectionState = (freshness: OverviewReadModelV1['freshness']): CollectionState => {
  if (freshness.availability === 'failed') return 'failed';
  if (
    freshness.availability === 'stale' ||
    (freshness.staleAfter !== null &&
      Date.parse(freshness.checkedAt) >= Date.parse(freshness.staleAfter))
  ) {
    return 'stale';
  }
  if (freshness.availability === 'partial') return 'partial';
  if (freshness.lastSuccessfulAt === null) return 'unavailable';
  if (freshness.availability === 'empty') return 'unavailable';
  return 'healthy';
};

const collectionAvailability = (state: CollectionState): OverviewAvailability =>
  state === 'healthy' ? 'complete' : state === 'unavailable' ? 'empty' : state;

const freshnessLag = (overview: OverviewReadModelV1): number | null =>
  overview.freshness.lastSuccessfulAt === null
    ? null
    : Date.parse(overview.freshness.checkedAt) - Date.parse(overview.freshness.lastSuccessfulAt);

const freshnessDetail = (lag: number | null): string => {
  if (lag === null) return 'No successful collection checkpoint is available.';
  if (lag < 60_000) {
    const seconds = Number((lag / 1_000).toFixed(1));
    return `${seconds} ${Math.abs(seconds) === 1 ? 'second' : 'seconds'} from last successful collection to freshness check.`;
  }
  if (lag < 3_600_000) {
    const minutes = Math.round(lag / 60_000);
    return `${minutes} ${Math.abs(minutes) === 1 ? 'minute' : 'minutes'} from last successful collection to freshness check.`;
  }
  const hours = Number((lag / 3_600_000).toFixed(1));
  return `${hours} ${Math.abs(hours) === 1 ? 'hour' : 'hours'} from last successful collection to freshness check.`;
};

const freshnessFact = (lag: number | null, availability: OverviewAvailability): PulseFact => ({
  key: 'collection-freshness',
  label: 'Collection freshness',
  value: lag,
  unit: 'milliseconds',
  detail: freshnessDetail(lag),
  evidenceLabel: 'Collection freshness evidence',
  availability,
  evidenceUrl: null,
});

const statusPrefix = (
  overview: OverviewReadModelV1,
  effectiveAvailability: OverviewAvailability,
): string => {
  if (
    effectiveAvailability === 'failed' ||
    overview.attention.some(({ severity }) => severity === 'critical')
  ) {
    return 'Attention required';
  }
  if (effectiveAvailability === 'stale') return 'Evidence stale';
  if (effectiveAvailability === 'partial' || overview.warnings.length > 0) {
    return 'Partial evidence';
  }
  if (effectiveAvailability === 'empty') return 'Evidence unavailable';
  return 'Evidence ready';
};

const collectionTitle = (state: CollectionState): string =>
  state === 'healthy' ? 'collection healthy' : `collection ${state}`;

const incompleteDetail = (incomplete: number, total: number): string => {
  if (total === 0) return 'No metric changes are available.';
  if (incomplete === 0) {
    return `All ${total} metrics have complete current and comparison evidence.`;
  }
  return `${incomplete} of ${total} metrics ${incomplete === 1 ? 'has' : 'have'} incomplete current or comparison evidence.`;
};

const openIssuesDecision = (change: OverviewChangeV1 | undefined): string => {
  if (!exactComparison(change)) return 'Exact Open issues comparison is unavailable.';
  if (change.delta === 0) return `Open issues were unchanged at ${change.current}.`;
  return `Open issues ${change.delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(change.delta)}, from ${change.previous} to ${change.current}.`;
};

const starsDecision = (change: OverviewChangeV1 | undefined): string => {
  if (change === undefined || change.current === null) {
    return 'Stars are unavailable; exact prior-period comparison is unavailable.';
  }
  if (!exactComparison(change)) {
    return `Stars are ${change.current}; exact prior-period comparison is unavailable.`;
  }
  return `Stars are ${change.current}; exact prior-period comparison is supported (${signed(change.delta)} from ${change.previous}).`;
};

const listLabels = (labels: string[]): string => {
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
};

const uniqueLabels = (labels: string[]): string[] => [...new Set(labels)];

const friendlySourceLabel = (overview: OverviewReadModelV1, sourceKey: string): string => {
  const contractLabel = overview.sources.find(({ key }) => key === sourceKey)?.label;
  if (contractLabel !== undefined) return contractLabel;

  return sourceKey
    .split(/[-_.]+/)
    .map((word) =>
      word.toLowerCase() === 'github' ? 'GitHub' : `${word[0]?.toUpperCase()}${word.slice(1)}`,
    )
    .join(' ');
};

const criticalSourceLabels = (overview: OverviewReadModelV1): string[] =>
  uniqueLabels(
    overview.attention
      .filter(({ severity }) => severity === 'critical')
      .map(({ sourceKey }) => friendlySourceLabel(overview, sourceKey)),
  );

const collectionLimitation = (collection: CollectionState): string | null => {
  if (collection === 'failed') return 'Collection failed.';
  if (collection === 'partial') return 'Collection is partial.';
  if (collection === 'unavailable') return 'Collection checkpoint is unavailable.';
  return null;
};

const limitedDecision = ({
  collection,
  criticalLabels,
  effectiveAvailability,
  hasAttention,
  labels,
}: {
  collection: CollectionState;
  criticalLabels: string[];
  effectiveAvailability: OverviewAvailability;
  hasAttention: boolean;
  labels: string[];
}): string => {
  const parts: string[] = [];
  if (collection === 'stale') {
    parts.push(
      labels.length > 0
        ? `Evidence is stale and limited for ${listLabels(labels)}.`
        : 'Collection evidence is stale.',
    );
  } else {
    if (labels.length > 0) parts.push(`Evidence is limited for ${listLabels(labels)}.`);
    const limitation = collectionLimitation(collection);
    if (limitation !== null) parts.push(limitation);
  }
  if (criticalLabels.length > 0) {
    parts.push(`Critical source evidence is limited for ${listLabels(criticalLabels)}.`);
  } else if (hasAttention && parts.length === 0) {
    parts.push('Attention evidence requires review.');
  }
  if (parts.length === 0 && effectiveAvailability !== 'complete') {
    parts.push('Overall evidence is not complete.');
  }
  return parts.length > 0 ? parts.join(' ') : 'No evidence limitations identified.';
};

const actionDecision = ({
  collection,
  criticalLabels,
  effectiveAvailability,
  hasAttention,
  hasIncompleteEvidence,
  view,
}: {
  collection: CollectionState;
  criticalLabels: string[];
  effectiveAvailability: OverviewAvailability;
  hasAttention: boolean;
  hasIncompleteEvidence: boolean;
  view: OverviewReadModelV1['view'];
}): string => {
  const window = `${view === 'current' ? 'current' : 'completed'}-window evidence`;
  let action: string | null = null;
  if (collection === 'failed') {
    action = `Rerun and review collection before acting on ${window}.`;
  } else if (collection === 'stale') {
    action = `Refresh and review ${hasIncompleteEvidence ? 'stale and incomplete' : 'stale'} ${window} before acting.`;
  } else if (collection === 'partial') {
    action = `Review incomplete collection evidence before acting on ${window}.`;
  } else if (collection === 'unavailable') {
    action = `Restore and review collection before acting on ${window}.`;
  } else if (hasIncompleteEvidence) {
    action = `Review incomplete ${window} before acting.`;
  }

  if (criticalLabels.length > 0) {
    const criticalAction = `Review critical source evidence for ${listLabels(criticalLabels)}`;
    action =
      action === null
        ? `${criticalAction} before acting on ${window}.`
        : `${action} ${criticalAction}.`;
  } else if (action === null && hasAttention) {
    action = `Review attention evidence before acting on ${window}.`;
  }
  if (action === null && effectiveAvailability !== 'complete') {
    action = `Review non-complete ${window} before acting.`;
  }
  return action ?? 'No evidence action required.';
};

const metricAttentionDetail = (change: OverviewChangeV1): string => {
  if (
    (change.metricKey === 'github.views' || change.metricKey === 'github.clones') &&
    change.coverage !== undefined
  ) {
    return `${change.coverage.currentObservedDays}/7 observed traffic days; current or comparison evidence is incomplete.`;
  }
  if (change.metricKey === 'github.release_asset_downloads') {
    return 'Release interval evidence is incomplete.';
  }
  if (!exactComparison(change)) return 'Exact prior-period comparison unavailable.';
  return 'Current or comparison evidence is incomplete.';
};

const buildAttentionItems = (
  overview: OverviewReadModelV1,
  incompleteChanges: OverviewChangeV1[],
  derivedTrafficCoverage: { detail: string; availability: OverviewAvailability } | null,
): ExecutivePulseAttentionItem[] => {
  const metricItems = new Map<string, ExecutivePulseAttentionItem>();
  for (const change of incompleteChanges) {
    const key = `metric:${metricAttentionKeys[change.metricKey]}`;
    if (!metricItems.has(key)) {
      metricItems.set(key, {
        key,
        label: change.label,
        detail: metricAttentionDetail(change),
        availability: change.availability,
        evidenceUrl: change.evidenceUrl,
        severity: 'warning',
      });
    }
  }

  const seenSourceExceptions = new Set<string>();
  const sourceItems: ExecutivePulseAttentionItem[] = [];

  for (const exception of overview.attention) {
    if (exception.severity !== 'critical') continue;
    const signature = [
      exception.sourceKey,
      exception.kind,
      exception.title,
      exception.detail,
      exception.evidenceUrl ?? '',
    ].join('\u0000');
    if (seenSourceExceptions.has(signature)) continue;
    seenSourceExceptions.add(signature);
    const sourceAvailability = overview.sources.find(
      ({ key }) => key === exception.sourceKey,
    )?.availability;
    sourceItems.push({
      key: `source:${exception.sourceKey}:${exception.kind}:${sourceItems.length}`,
      label: exception.title,
      detail: exception.detail,
      availability: sourceAvailability ?? overview.availability,
      evidenceUrl: exception.evidenceUrl,
      severity: 'critical',
    });
  }

  const derivedItems: ExecutivePulseAttentionItem[] =
    derivedTrafficCoverage !== null
      ? [
          {
            key: 'derived:traffic-coverage',
            label: 'Traffic coverage',
            detail: derivedTrafficCoverage.detail,
            availability: derivedTrafficCoverage.availability,
            evidenceUrl: null,
            severity: 'warning',
          },
        ]
      : [];

  return [...metricItems.values(), ...derivedItems, ...sourceItems];
};

export const buildExecutivePulseModel = (overview: OverviewReadModelV1): ExecutivePulseModel => {
  const changes = deduplicateChanges(overview.changes);
  const stars = findChange(changes, 'github.stars');
  const views = findChange(changes, 'github.views');
  const clones = findChange(changes, 'github.clones');
  const openIssues = findChange(changes, 'github.open_issues');
  const incompleteChanges = changes.filter(incompleteChange);
  const collection = effectiveCollectionState(overview.freshness);
  const freshnessAvailability = collectionAvailability(collection);
  const lag = freshnessLag(overview);
  const trafficCoverage = trafficCoverageFact(views, clones);
  const missingTrafficCoverage =
    views !== undefined &&
    clones !== undefined &&
    !incompleteChange(views) &&
    !incompleteChange(clones) &&
    (views.coverage === undefined || clones.coverage === undefined);
  const trafficRequiredDays =
    views?.coverage !== undefined && clones?.coverage !== undefined
      ? Math.max(views.coverage.requiredDays, clones.coverage.requiredDays)
      : 7;
  const partialTrafficCoverage =
    trafficCoverage.value !== null && trafficCoverage.value < trafficRequiredDays;
  const trafficCoverageLimited = missingTrafficCoverage || partialTrafficCoverage;
  const trafficMetricAlreadyIncomplete = incompleteChanges.some(
    ({ metricKey }) => metricKey === 'github.views' || metricKey === 'github.clones',
  );
  const derivedTrafficCoverage =
    trafficCoverageLimited && !trafficMetricAlreadyIncomplete
      ? {
          detail: missingTrafficCoverage
            ? 'Current observed-day traffic coverage is unavailable.'
            : trafficCoverage.detail,
          availability: trafficCoverage.availability,
        }
      : null;
  const metricAvailability =
    overview.availability === 'complete' && trafficCoverageLimited
      ? 'partial'
      : overview.availability;
  const effectiveAvailability = lessAvailable(metricAvailability, freshnessAvailability);
  const limitedLabels = uniqueLabels([
    ...incompleteChanges.map(({ label }) => label),
    ...(trafficCoverageLimited ? ['Traffic coverage'] : []),
  ]);
  const hasIncompleteEvidence = limitedLabels.length > 0;
  const criticalLabels = criticalSourceLabels(overview);
  const operatingDetail =
    derivedTrafficCoverage !== null
      ? [
          incompleteChanges.length > 0
            ? incompleteDetail(incompleteChanges.length, changes.length)
            : null,
          derivedTrafficCoverage.detail,
        ]
          .filter((detail): detail is string => detail !== null)
          .join(' ')
      : incompleteDetail(incompleteChanges.length, changes.length);

  return {
    operatingStatus: {
      availability: effectiveAvailability,
      collectionHealthy: collection === 'healthy',
      title: `${statusPrefix(overview, effectiveAvailability)} · ${collectionTitle(collection)}`,
      detail: operatingDetail,
      incompleteMetricCount: incompleteChanges.length,
    },
    facts: {
      stars: metricFact(stars, { key: 'stars', label: 'Stars', unit: 'count' }),
      openIssues: metricFact(openIssues, {
        key: 'open-issues',
        label: 'Open issues',
        unit: 'count',
      }),
      trafficCoverage,
      freshness: freshnessFact(lag, freshnessAvailability),
    },
    decisionRows: [
      { key: 'changed', label: 'Changed', text: openIssuesDecision(openIssues) },
      { key: 'known', label: 'Known', text: starsDecision(stars) },
      {
        key: 'limited',
        label: 'Limited',
        text: limitedDecision({
          collection,
          criticalLabels,
          effectiveAvailability,
          hasAttention: overview.attention.length > 0,
          labels: limitedLabels,
        }),
      },
      {
        key: 'action',
        label: 'Action',
        text: actionDecision({
          collection,
          criticalLabels,
          effectiveAvailability,
          hasAttention: overview.attention.length > 0,
          hasIncompleteEvidence,
          view: overview.view,
        }),
      },
    ],
    attentionItems: buildAttentionItems(overview, incompleteChanges, derivedTrafficCoverage),
    evidenceHealth: {
      overall: effectiveAvailability,
      collection,
      trafficObservedDays: trafficCoverage.value,
      trafficRequiredDays: 7,
      freshnessLagMilliseconds: lag,
      briefing: overview.briefing.availability,
    },
    authoredBriefing: overview.briefing,
  };
};
