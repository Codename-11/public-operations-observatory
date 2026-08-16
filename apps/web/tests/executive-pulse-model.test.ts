import { describe, expect, it } from 'vitest';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';

import { buildExecutivePulseModel } from '../lib/executive-pulse-model';

const evidence = (suffix: string) =>
  `https://api.github.com/repos/Codename-11/hermes-relay/${suffix}`;

const metric = (
  metricKey: OverviewReadModelV1['changes'][number]['metricKey'],
  label: string,
  current: number,
  previous: number,
): OverviewReadModelV1['changes'][number] => ({
  metricKey,
  label,
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
  evidenceUrl: evidence(metricKey.replace('github.', '')),
  provenanceRefs: [],
  ...(metricKey === 'github.views' || metricKey === 'github.clones'
    ? { coverage: { currentObservedDays: 7, previousObservedDays: 7, requiredDays: 7 } }
    : {}),
});

const completeOverview = (): OverviewReadModelV1 => ({
  version: 1,
  view: 'current',
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
    metric('github.stars', 'Stars', 120, 100),
    metric('github.views', 'Page views', 60, 50),
    metric('github.clones', 'Repository clones', 22, 20),
    metric('github.release_asset_downloads', 'Release asset downloads', 31, 25),
    metric('github.open_issues', 'Open issues', 8, 10),
  ],
  trend: {
    metricKey: 'github.release_asset_downloads',
    label: 'Release asset downloads',
    unit: 'downloads',
    availability: 'complete',
    points: [
      {
        timestamp: '2026-08-04T00:00:00.000Z',
        availability: 'complete',
        value: 31,
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
    summary: 'Authored briefing copied without alteration.',
    generatedAt: '2026-08-10T00:03:00.000Z',
    evidenceUrl: 'https://github.com/Codename-11/hermes-relay',
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
    references: [],
  },
});

const makePartialLiveOverview = (): OverviewReadModelV1 => {
  const overview = completeOverview();
  const [stars, views, clones, releaseDownloads, openIssues] = overview.changes;

  return {
    ...overview,
    availability: 'partial',
    warnings: [
      {
        code: 'incomplete_metric_window',
        metricKey: 'github.views',
        message: 'github.views and github.clones are incomplete; github.stars has no checkpoint.',
      },
      {
        code: 'incomplete_metric_window',
        metricKey: 'github.views',
        message: 'duplicate warning that must not become duplicate attention',
      },
    ],
    changes: [
      { ...stars!, availability: 'partial', current: 120, previous: null, delta: null },
      {
        ...views!,
        availability: 'partial',
        current: 60,
        previous: 50,
        delta: null,
        coverage: { currentObservedDays: 5, previousObservedDays: 7, requiredDays: 7 },
      },
      {
        ...clones!,
        availability: 'partial',
        coverage: { currentObservedDays: 6, previousObservedDays: 7, requiredDays: 7 },
      },
      {
        ...releaseDownloads!,
        availability: 'partial',
        current: 31,
        previous: null,
        delta: null,
      },
      openIssues!,
    ],
    attention: [
      {
        kind: 'incomplete_metric_window',
        sourceKey: 'github',
        severity: 'warning',
        title: 'Traffic interval incomplete',
        detail: 'Supplied duplicate of the Page views metric limitation.',
        detectedAt: overview.asOf,
        evidenceUrl: views!.evidenceUrl,
        provenanceRefs: [],
      },
      {
        kind: 'partial_run',
        sourceKey: 'github',
        severity: 'warning',
        title: 'Non-critical source note',
        detail: 'Warnings are not promoted into the compact attention list.',
        detectedAt: overview.asOf,
        evidenceUrl: null,
        provenanceRefs: [],
      },
    ],
  };
};

describe('buildExecutivePulseModel', () => {
  it('projects a complete model with exact facts, comparisons, and authored briefing', () => {
    const overview = completeOverview();
    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus).toEqual({
      availability: 'complete',
      collectionHealthy: true,
      title: 'Evidence ready · collection healthy',
      detail: 'All 5 metrics have complete current and comparison evidence.',
      incompleteMetricCount: 0,
    });
    expect(model.facts.stars).toMatchObject({
      key: 'stars',
      label: 'Stars',
      value: 120,
      unit: 'count',
      detail: 'Prior 100 · change +20.',
      availability: 'complete',
    });
    expect(model.facts.openIssues.detail).toBe('Prior 10 · change -2.');
    expect(model.facts.trafficCoverage).toMatchObject({
      value: 7,
      unit: 'days',
      detail: '7/7 observed days.',
      availability: 'complete',
    });
    expect(model.facts.freshness).toMatchObject({
      value: 240_000,
      unit: 'milliseconds',
      detail: '4 minutes from last successful collection to freshness check.',
    });
    expect(model.decisionRows).toEqual([
      {
        key: 'changed',
        label: 'Changed',
        text: 'Open issues decreased by 2, from 10 to 8.',
      },
      {
        key: 'known',
        label: 'Known',
        text: 'Stars are 120; exact prior-period comparison is supported (+20 from 100).',
      },
      {
        key: 'limited',
        label: 'Limited',
        text: 'No evidence limitations identified.',
      },
      {
        key: 'action',
        label: 'Action',
        text: 'No evidence action required.',
      },
    ]);
    expect(model.attentionItems).toEqual([]);
    expect(model.evidenceHealth).toEqual({
      overall: 'complete',
      collection: 'healthy',
      trafficObservedDays: 7,
      trafficRequiredDays: 7,
      freshnessLagMilliseconds: 240_000,
      briefing: 'complete',
    });
    expect(model.authoredBriefing).toEqual(overview.briefing);
  });

  it('marks 3/7 traffic coverage partial and derives one reviewable limitation', () => {
    const overview = completeOverview();
    const views = overview.changes.find(({ metricKey }) => metricKey === 'github.views')!;
    const clones = overview.changes.find(({ metricKey }) => metricKey === 'github.clones')!;
    views.coverage = { currentObservedDays: 3, previousObservedDays: 7, requiredDays: 7 };
    clones.coverage = { currentObservedDays: 5, previousObservedDays: 7, requiredDays: 7 };

    const model = buildExecutivePulseModel(overview);

    expect(model.facts.trafficCoverage).toMatchObject({
      value: 3,
      detail: '3/7 observed days.',
      availability: 'partial',
    });
    expect(model.operatingStatus).toMatchObject({
      availability: 'partial',
      title: 'Partial evidence · collection healthy',
    });
    expect(model.evidenceHealth).toMatchObject({
      overall: 'partial',
      trafficObservedDays: 3,
      trafficRequiredDays: 7,
    });
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Evidence is limited for Traffic coverage.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Review incomplete current-window evidence before acting.',
    });
    expect(model.attentionItems).toEqual([
      {
        key: 'derived:traffic-coverage',
        label: 'Traffic coverage',
        detail: '3/7 observed days.',
        availability: 'partial',
        evidenceUrl: null,
        severity: 'warning',
      },
    ]);
  });

  it('keeps the 7/7 traffic coverage boundary ready without derived attention', () => {
    const overview = completeOverview();
    const views = overview.changes.find(({ metricKey }) => metricKey === 'github.views')!;
    const clones = overview.changes.find(({ metricKey }) => metricKey === 'github.clones')!;
    views.coverage = { currentObservedDays: 7, previousObservedDays: 7, requiredDays: 7 };
    clones.coverage = { currentObservedDays: 8, previousObservedDays: 7, requiredDays: 7 };

    const model = buildExecutivePulseModel(overview);

    expect(model.facts.trafficCoverage).toMatchObject({
      value: 7,
      detail: '7/7 observed days.',
      availability: 'complete',
    });
    expect(model.evidenceHealth.overall).toBe('complete');
    expect(model.attentionItems).toEqual([]);
  });

  it.each([
    ['both traffic metrics', ['github.views', 'github.clones']],
    ['one traffic metric', ['github.views']],
  ] as const)(
    'projects missing derived traffic coverage as one limitation when coverage is absent from %s',
    (_, metricKeys) => {
      const overview = completeOverview();
      for (const change of overview.changes) {
        if (metricKeys.some((metricKey) => metricKey === change.metricKey)) {
          delete change.coverage;
        }
      }

      const model = buildExecutivePulseModel(overview);

      expect(model.operatingStatus).toEqual({
        availability: 'partial',
        collectionHealthy: true,
        title: 'Partial evidence · collection healthy',
        detail: 'Current observed-day traffic coverage is unavailable.',
        incompleteMetricCount: 0,
      });
      expect(model.facts.trafficCoverage).toMatchObject({
        value: null,
        availability: 'empty',
        detail:
          'Current observed-day traffic coverage is unavailable because both traffic coverage records are required.',
      });
      expect(model.decisionRows).toContainEqual({
        key: 'limited',
        label: 'Limited',
        text: 'Evidence is limited for Traffic coverage.',
      });
      expect(model.decisionRows).toContainEqual({
        key: 'action',
        label: 'Action',
        text: 'Review incomplete current-window evidence before acting.',
      });
      expect(model.attentionItems).toEqual([
        {
          key: 'derived:traffic-coverage',
          label: 'Traffic coverage',
          detail: 'Current observed-day traffic coverage is unavailable.',
          availability: 'empty',
          evidenceUrl: null,
          severity: 'warning',
        },
      ]);
      expect(model.evidenceHealth).toMatchObject({
        overall: 'partial',
        trafficObservedDays: null,
      });
    },
  );

  it('does not add derived traffic coverage when a traffic metric is already incomplete', () => {
    const overview = completeOverview();
    const views = overview.changes.find(({ metricKey }) => metricKey === 'github.views')!;
    views.availability = 'partial';
    views.delta = null;
    delete views.coverage;

    const model = buildExecutivePulseModel(overview);

    expect(model.attentionItems.map(({ key }) => key)).toEqual(['metric:views']);
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Evidence is limited for Page views.',
    });
  });

  it('deduplicates repeated metric changes by metric key using the first contract record', () => {
    const overview = completeOverview();
    const firstStars = overview.changes[0]!;
    overview.availability = 'partial';
    overview.changes[0] = {
      ...firstStars,
      availability: 'partial',
      previous: null,
      delta: null,
    };
    overview.changes.push({
      ...firstStars,
      label: 'Duplicate Stars',
      availability: 'failed',
      current: null,
      previous: null,
      delta: null,
    });

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus).toMatchObject({
      incompleteMetricCount: 1,
      detail: '1 of 5 metrics has incomplete current or comparison evidence.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Evidence is limited for Stars.',
    });
    expect(
      model.attentionItems.filter(
        (item: (typeof model.attentionItems)[number]) => item.key === 'metric:stars',
      ),
    ).toEqual([
      expect.objectContaining({
        label: 'Stars',
        availability: 'partial',
      }),
    ]);
    expect(JSON.stringify(model)).not.toContain('Duplicate Stars');
  });

  it('projects live partial evidence without inventing unsupported comparisons', () => {
    const model = buildExecutivePulseModel(makePartialLiveOverview());

    expect(model.operatingStatus).toMatchObject({
      title: 'Partial evidence · collection healthy',
      collectionHealthy: true,
      incompleteMetricCount: 4,
      detail: '4 of 5 metrics have incomplete current or comparison evidence.',
    });
    expect(model.evidenceHealth.collection).toBe('healthy');
    expect(model.facts.stars).toMatchObject({
      value: 120,
      detail: 'Exact prior-period comparison unavailable.',
      availability: 'partial',
    });
    expect(model.facts.trafficCoverage).toMatchObject({
      value: 5,
      detail: '5/7 observed days.',
      availability: 'partial',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'changed',
      label: 'Changed',
      text: 'Open issues decreased by 2, from 10 to 8.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'known',
      label: 'Known',
      text: 'Stars are 120; exact prior-period comparison is unavailable.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Evidence is limited for Stars, Page views, Repository clones, Release asset downloads, and Traffic coverage.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Review incomplete current-window evidence before acting.',
    });
    expect(model.attentionItems.map(({ label }) => label)).toEqual([
      'Stars',
      'Page views',
      'Repository clones',
      'Release asset downloads',
    ]);
    expect(model.attentionItems.map(({ detail }) => detail)).toEqual([
      'Exact prior-period comparison unavailable.',
      '5/7 observed traffic days; current or comparison evidence is incomplete.',
      '6/7 observed traffic days; current or comparison evidence is incomplete.',
      'Release interval evidence is incomplete.',
    ]);
  });

  it('preserves null values and reports no checkpoint without using wall-clock time', () => {
    const overview = completeOverview();
    overview.availability = 'empty';
    overview.freshness = {
      availability: 'empty',
      checkedAt: '2026-08-10T00:05:00.000Z',
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

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus).toMatchObject({
      collectionHealthy: false,
      title: 'Evidence unavailable · collection unavailable',
    });
    expect(model.facts.stars.value).toBeNull();
    expect(model.facts.stars.detail).toBe('Current value and exact comparison unavailable.');
    expect(model.facts.freshness).toMatchObject({
      value: null,
      detail: 'No successful collection checkpoint is available.',
    });
    expect(model.evidenceHealth).toMatchObject({
      collection: 'unavailable',
      freshnessLagMilliseconds: null,
    });
  });

  it('uses completed-window action wording when limitations remain', () => {
    const overview = makePartialLiveOverview();
    overview.view = 'completed';

    expect(buildExecutivePulseModel(overview).decisionRows.at(-1)).toEqual({
      key: 'action',
      label: 'Action',
      text: 'Review incomplete completed-window evidence before acting.',
    });
  });

  it('treats collection evidence as stale when checkedAt is exactly staleAfter', () => {
    const overview = completeOverview();
    overview.freshness.checkedAt = overview.freshness.staleAfter!;

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus).toMatchObject({
      availability: 'stale',
      collectionHealthy: false,
      title: 'Evidence stale · collection stale',
    });
    expect(model.facts.freshness).toMatchObject({
      availability: 'stale',
      value: 21_600_000,
    });
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Collection evidence is stale.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Refresh and review stale current-window evidence before acting.',
    });
    expect(model.attentionItems).toEqual([]);
    expect(model.evidenceHealth).toMatchObject({
      overall: 'stale',
      collection: 'stale',
      freshnessLagMilliseconds: 21_600_000,
    });
  });

  it('keeps collection evidence healthy immediately before staleAfter', () => {
    const overview = completeOverview();
    overview.freshness.checkedAt = '2026-08-10T06:00:59.999Z';

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus).toMatchObject({
      availability: 'complete',
      collectionHealthy: true,
      title: 'Evidence ready · collection healthy',
    });
    expect(model.facts.freshness).toMatchObject({
      availability: 'complete',
      value: 21_599_999,
    });
    expect(model.evidenceHealth).toMatchObject({
      overall: 'complete',
      collection: 'healthy',
      freshnessLagMilliseconds: 21_599_999,
    });
  });

  it('applies evidence-readiness status precedence without describing business health', () => {
    const stale = completeOverview();
    stale.availability = 'stale';
    stale.freshness.availability = 'stale';
    expect(buildExecutivePulseModel(stale).operatingStatus).toMatchObject({
      collectionHealthy: false,
      title: 'Evidence stale · collection stale',
    });

    const failed = completeOverview();
    failed.availability = 'failed';
    expect(buildExecutivePulseModel(failed).operatingStatus.title).toBe(
      'Attention required · collection healthy',
    );

    const warning = completeOverview();
    warning.warnings.push({ code: 'partial_run', message: 'A supplied evidence warning.' });
    expect(buildExecutivePulseModel(warning).operatingStatus.title).toBe(
      'Partial evidence · collection healthy',
    );
  });

  it('requires attention when freshness fails despite a complete overview', () => {
    const overview = completeOverview();
    overview.freshness.availability = 'failed';

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus.title).toBe('Attention required · collection failed');
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Collection failed.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Rerun and review collection before acting on current-window evidence.',
    });
    expect(model.decisionRows.map(({ text }) => text)).not.toContain(
      'No evidence limitations identified.',
    );
    expect(model.decisionRows.map(({ text }) => text)).not.toContain(
      'No evidence action required.',
    );
    expect(model.attentionItems).toEqual([]);
  });

  it('reports partial collection when freshness is partial', () => {
    const overview = completeOverview();
    overview.freshness.availability = 'partial';

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus).toMatchObject({
      collectionHealthy: false,
      title: 'Partial evidence · collection partial',
    });
    expect(model.evidenceHealth.collection).toBe('partial');
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Collection is partial.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Review incomplete collection evidence before acting on current-window evidence.',
    });
  });

  it('preserves failed and stale collection states when no checkpoint is available', () => {
    const failed = completeOverview();
    failed.freshness = {
      ...failed.freshness,
      availability: 'failed',
      lastSuccessfulAt: null,
    };
    expect(buildExecutivePulseModel(failed).operatingStatus).toMatchObject({
      collectionHealthy: false,
      title: 'Attention required · collection failed',
    });
    expect(buildExecutivePulseModel(failed).evidenceHealth.collection).toBe('failed');

    const stale = completeOverview();
    stale.freshness = {
      ...stale.freshness,
      availability: 'stale',
      lastSuccessfulAt: null,
    };
    expect(buildExecutivePulseModel(stale).operatingStatus).toMatchObject({
      collectionHealthy: false,
      title: 'Evidence stale · collection stale',
    });
    expect(buildExecutivePulseModel(stale).evidenceHealth.collection).toBe('stale');
  });

  it('reports unavailable evidence when freshness is empty despite a complete overview', () => {
    const overview = completeOverview();
    overview.freshness.availability = 'empty';

    const model = buildExecutivePulseModel(overview);

    expect(model.operatingStatus.title).toBe('Evidence unavailable · collection unavailable');
    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Collection checkpoint is unavailable.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Restore and review collection before acting on current-window evidence.',
    });
  });

  it('does not duplicate warning-derived or already represented attention output', () => {
    const overview = makePartialLiveOverview();
    const critical = {
      kind: 'source_failure' as const,
      sourceKey: 'github-actions',
      severity: 'critical' as const,
      title: 'Workflow evidence source failed',
      detail: 'The supplied source-only exception remains visible.',
      detectedAt: overview.asOf,
      evidenceUrl: evidence('actions'),
      provenanceRefs: [],
    };
    overview.attention.push(critical, { ...critical });

    const model = buildExecutivePulseModel(overview);
    const keys = model.attentionItems.map(({ key }) => key);

    expect(model.operatingStatus.title).toBe('Attention required · collection healthy');
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      model.attentionItems.filter(({ label }) => label === 'Traffic interval incomplete'),
    ).toHaveLength(0);
    expect(
      model.attentionItems.filter(({ label }) => label === 'Workflow evidence source failed'),
    ).toHaveLength(1);
    expect(model.attentionItems.at(-1)).toMatchObject({
      availability: 'partial',
      detail: 'The supplied source-only exception remains visible.',
      evidenceUrl: evidence('actions'),
      severity: 'critical',
    });
    expect(JSON.stringify(model)).not.toContain('duplicate warning');
    expect(JSON.stringify(model)).not.toContain('github.views and github.clones');
  });

  it('preserves a critical source exception that shares a metric evidence URL', () => {
    const overview = completeOverview();
    const views = overview.changes.find(({ metricKey }) => metricKey === 'github.views')!;
    views.availability = 'partial';
    views.delta = null;
    overview.attention.push({
      kind: 'source_failure',
      sourceKey: 'github',
      severity: 'critical',
      title: 'GitHub source collection failed',
      detail: 'The source failure is distinct from the incomplete views comparison.',
      detectedAt: overview.asOf,
      evidenceUrl: views.evidenceUrl,
      provenanceRefs: [],
    });

    const matchingItems = buildExecutivePulseModel(overview).attentionItems.filter(
      ({ evidenceUrl }) => evidenceUrl === views.evidenceUrl,
    );

    expect(matchingItems).toHaveLength(2);
    expect(matchingItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'metric:views',
          severity: 'warning',
        }),
        expect.objectContaining({
          label: 'GitHub source collection failed',
          detail: 'The source failure is distinct from the incomplete views comparison.',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('names critical source evidence in decisions even when metrics are complete', () => {
    const overview = completeOverview();
    overview.attention.push({
      kind: 'source_failure',
      sourceKey: 'github',
      severity: 'critical',
      title: 'GitHub source collection failed',
      detail: 'Critical GitHub evidence must be reviewed.',
      detectedAt: overview.asOf,
      evidenceUrl: evidence('critical-source'),
      provenanceRefs: [],
    });

    const model = buildExecutivePulseModel(overview);

    expect(model.decisionRows).toContainEqual({
      key: 'limited',
      label: 'Limited',
      text: 'Critical source evidence is limited for GitHub.',
    });
    expect(model.decisionRows).toContainEqual({
      key: 'action',
      label: 'Action',
      text: 'Review critical source evidence for GitHub before acting on current-window evidence.',
    });
    expect(model.attentionItems).toEqual([
      expect.objectContaining({
        label: 'GitHub source collection failed',
        evidenceUrl: evidence('critical-source'),
        severity: 'critical',
      }),
    ]);
  });

  it('contains no attribution, adoption, or causation claims', () => {
    const forbidden = /attribution|conversion|adoption|visitor|caused|because|led to|resulted in/i;

    expect(JSON.stringify(buildExecutivePulseModel(completeOverview()))).not.toMatch(forbidden);
    expect(JSON.stringify(buildExecutivePulseModel(makePartialLiveOverview()))).not.toMatch(
      forbidden,
    );
  });
});
