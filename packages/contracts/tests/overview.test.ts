import { describe, expect, it } from 'vitest';

import {
  EvidenceUrlSchema,
  OverviewMetricKeySchema,
  OverviewReadModelV1RequestSchema,
  OverviewReadModelV1Schema,
} from '../src/overview.js';

const completeOverview = {
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
      provenanceRefs: ['metric:stars:2026-08-10'],
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
        value: 31,
        availability: 'complete',
        provenanceRefs: ['metric:downloads:2026-08-04'],
      },
    ],
    annotations: [
      {
        id: 'annotation:release:v1.2.3',
        kind: 'release',
        label: 'v1.2.3 released',
        occurredAt: '2026-08-04T12:00:00.000Z',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
        provenanceRefs: ['annotation:release:v1.2.3'],
      },
    ],
  },
  release: {
    availability: 'complete',
    tagName: 'v1.2.3',
    name: 'Hermes-Relay v1.2.3',
    publishedAt: '2026-08-04T12:00:00.000Z',
    evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
    assetDownloads: 31,
    provenanceRefs: ['release:v1.2.3'],
  },
  briefing: {
    availability: 'complete',
    summary: 'Stars and release asset downloads increased during the review window.',
    generatedAt: '2026-08-10T00:03:00.000Z',
    evidenceUrl: null,
    provenanceRefs: ['briefing:2026-08-10'],
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
      provenanceRefs: ['source:github:2026-08-10'],
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
        ref: 'metric:stars:2026-08-10',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay',
      },
      {
        ref: 'metric:downloads:2026-08-04',
        sourceKey: 'github',
        observedAt: '2026-08-04T00:00:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay/releases',
      },
      {
        ref: 'annotation:release:v1.2.3',
        sourceKey: 'github',
        observedAt: '2026-08-04T12:00:00.000Z',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases/tag/v1.2.3',
      },
      {
        ref: 'release:v1.2.3',
        sourceKey: 'github',
        observedAt: '2026-08-04T12:00:00.000Z',
        evidenceUrl: 'https://api.github.com/repos/Codename-11/hermes-relay/releases/tags/v1.2.3',
      },
      {
        ref: 'briefing:2026-08-10',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:03:00.000Z',
        evidenceUrl: null,
      },
      {
        ref: 'source:github:2026-08-10',
        sourceKey: 'github',
        observedAt: '2026-08-10T00:01:00.000Z',
        evidenceUrl: 'https://github.com/Codename-11/hermes-relay',
      },
    ],
  },
};

const cloneCompleteOverview = (): typeof completeOverview => structuredClone(completeOverview);

describe('OverviewReadModelV1RequestSchema', () => {
  it('accepts only the fixed seven-day period and canonical optional timestamps', () => {
    expect(
      OverviewReadModelV1RequestSchema.parse({
        projectKey: 'hermes-relay',
        period: '7d',
        windowEnd: '2026-08-10T00:00:00.000Z',
        asOf: '2026-08-10T00:05:00.000Z',
      }),
    ).toEqual({
      projectKey: 'hermes-relay',
      period: '7d',
      windowEnd: '2026-08-10T00:00:00.000Z',
      asOf: '2026-08-10T00:05:00.000Z',
    });

    expect(() =>
      OverviewReadModelV1RequestSchema.parse({ projectKey: 'hermes-relay', period: '30d' }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1RequestSchema.parse({
        projectKey: 'hermes-relay',
        period: '7d',
        asOf: '2026-08-10T01:05:00.000+01:00',
      }),
    ).toThrow();
  });

  it('rejects unknown request keys', () => {
    expect(() =>
      OverviewReadModelV1RequestSchema.parse({
        projectKey: 'hermes-relay',
        period: '7d',
        includePrivate: true,
      }),
    ).toThrow();
  });
});

describe('Overview metric registration', () => {
  it.each([
    'github.stars',
    'github.views',
    'github.clones',
    'github.release_asset_downloads',
    'github.open_issues',
  ])('accepts the Phase 0 v1 metric key %s', (metricKey) => {
    expect(OverviewMetricKeySchema.parse(metricKey)).toBe(metricKey);
  });

  it.each(['github.repository.stars', 'github.release_asset.downloads', 'github.forks'])(
    'rejects unregistered metric key %s',
    (metricKey) => {
      expect(() => OverviewMetricKeySchema.parse(metricKey)).toThrow();
    },
  );
});

describe('EvidenceUrlSchema', () => {
  it.each([
    'https://github.com/Codename-11/hermes-relay',
    'https://api.github.com/repos/Codename-11/hermes-relay',
  ])('accepts the public v1 evidence URL %s', (url) => {
    expect(EvidenceUrlSchema.parse(url)).toBe(url);
  });

  it.each([
    'http://github.com/Codename-11/hermes-relay',
    'https://user:password@github.com/Codename-11/hermes-relay',
    'https://github.com/Codename-11/hermes-relay#private',
    'https://api.github.com/repos/Codename-11/hermes-relay?access_token=ghp_secret',
    'https://localhost/evidence',
    'https://127.0.0.1/evidence',
    'https://10.0.0.1/evidence',
    'https://169.254.1.1/evidence',
    'https://github.com.evil.example/evidence',
    'https://evil.example/evidence',
    'https://github.com/%00evidence',
  ])('rejects unsafe or unapproved evidence URL %s', (url) => {
    expect(() => EvidenceUrlSchema.parse(url)).toThrow();
  });
});

describe('OverviewReadModelV1Schema', () => {
  it('accepts a complete Overview with numeric metric definition version 1', () => {
    expect(OverviewReadModelV1Schema.parse(completeOverview)).toEqual(completeOverview);
    expect(
      OverviewReadModelV1Schema.parse(completeOverview).provenance.metricDefinitionVersion,
    ).toBe(1);
  });

  it('rejects string metric definition versions', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        provenance: { ...completeOverview.provenance, metricDefinitionVersion: '1' },
      }),
    ).toThrow();
  });

  it('enforces the exact Phase 0 repository and matching scope', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        project: { ...completeOverview.project, scope: 'github:Codename-11/hermes-relay' },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        project: { ...completeOverview.project, repository: 'Codename-11/other' },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        provenance: { ...completeOverview.provenance, scope: 'Codename-11/other' },
      }),
    ).toThrow();
  });

  it('allows Phase 0 other annotations', () => {
    const overview = cloneCompleteOverview();
    overview.trend.annotations[0]!.kind = 'other';
    expect(OverviewReadModelV1Schema.parse(overview).trend.annotations[0]!.kind).toBe('other');
  });

  it('accepts genuinely suppressed partial values with source-only attention exceptions', () => {
    const partial = {
      ...completeOverview,
      availability: 'partial',
      freshness: { ...completeOverview.freshness, availability: 'stale' },
      warnings: [
        {
          code: 'incomplete_metric_window',
          message: 'Release asset downloads are incomplete for the current window.',
          sourceKey: 'github',
          metricKey: 'github.release_asset_downloads',
        },
      ],
      changes: [
        {
          ...completeOverview.changes[0],
          availability: 'partial',
          current: null,
          previous: null,
          delta: null,
        },
      ],
      trend: {
        ...completeOverview.trend,
        availability: 'partial',
        points: [
          {
            ...completeOverview.trend.points[0],
            availability: 'partial',
            value: null,
          },
        ],
      },
      release: {
        availability: 'failed',
        tagName: null,
        name: null,
        publishedAt: null,
        evidenceUrl: null,
        assetDownloads: null,
        provenanceRefs: [],
      },
      briefing: {
        availability: 'empty',
        summary: null,
        generatedAt: null,
        evidenceUrl: null,
        provenanceRefs: [],
      },
      sources: [
        {
          ...completeOverview.sources[0],
          availability: 'partial',
          warnings: ['One required endpoint did not complete.'],
        },
      ],
      attention: [
        {
          kind: 'incomplete_metric_window',
          sourceKey: 'github',
          severity: 'warning',
          title: 'Incomplete release metric',
          detail: 'Release asset downloads are unavailable for part of this window.',
          detectedAt: '2026-08-10T00:05:00.000Z',
          evidenceUrl: 'https://github.com/Codename-11/hermes-relay/releases',
          provenanceRefs: ['source:github:2026-08-10'],
        },
      ],
    };

    const parsed = OverviewReadModelV1Schema.parse(partial);
    expect(parsed.availability).toBe('partial');
    expect(parsed.changes[0]!.current).toBeNull();
    expect(parsed.trend.points[0]!.value).toBeNull();
    expect(parsed.release?.assetDownloads).toBeNull();
    expect(parsed.briefing.summary).toBeNull();
  });

  it.each(['complete', 'partial', 'stale', 'failed', 'empty'] as const)(
    'allows the %s top-level availability state',
    (availability) => {
      expect(
        OverviewReadModelV1Schema.parse({ ...completeOverview, availability }).availability,
      ).toBe(availability);
    },
  );

  it('rejects unknown keys at request, top-level, and nested object boundaries', () => {
    expect(() => OverviewReadModelV1Schema.parse({ ...completeOverview, secret: true })).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        project: { ...completeOverview.project, ownerEmail: 'private@example.test' },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        trend: {
          ...completeOverview.trend,
          points: [{ ...completeOverview.trend.points[0], privateNote: 'not public' }],
        },
      }),
    ).toThrow();
  });

  it('requires values when metric, release, briefing, and trend states are complete', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], current: null }],
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        trend: {
          ...completeOverview.trend,
          points: [{ ...completeOverview.trend.points[0], value: null }],
        },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        release: { ...completeOverview.release, assetDownloads: null },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        briefing: { ...completeOverview.briefing, summary: null },
      }),
    ).toThrow();
  });

  it('allows retained values only for partial or stale states', () => {
    const retained = cloneCompleteOverview();
    retained.changes[0]!.availability = 'stale';
    retained.trend.availability = 'partial';
    retained.trend.points[0]!.availability = 'partial';
    retained.release.availability = 'stale';
    retained.briefing.availability = 'partial';
    expect(OverviewReadModelV1Schema.parse(retained).changes[0]!.current).toBe(120);

    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], availability: 'failed' }],
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        trend: {
          ...completeOverview.trend,
          availability: 'failed',
          points: [{ ...completeOverview.trend.points[0], availability: 'failed' }],
        },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        release: {
          ...completeOverview.release,
          availability: 'empty',
          tagName: null,
          publishedAt: null,
          evidenceUrl: null,
          assetDownloads: null,
        },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        briefing: { ...completeOverview.briefing, availability: 'failed' },
      }),
    ).toThrow();
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY])(
    'rejects invalid count value %s',
    (value) => {
      expect(() =>
        OverviewReadModelV1Schema.parse({
          ...completeOverview,
          changes: [{ ...completeOverview.changes[0], current: value }],
        }),
      ).toThrow();
      expect(() =>
        OverviewReadModelV1Schema.parse({
          ...completeOverview,
          trend: {
            ...completeOverview.trend,
            points: [{ ...completeOverview.trend.points[0], value }],
          },
        }),
      ).toThrow();
      expect(() =>
        OverviewReadModelV1Schema.parse({
          ...completeOverview,
          release: { ...completeOverview.release, assetDownloads: value },
        }),
      ).toThrow();
    },
  );

  it('permits negative integer deltas but rejects fractional deltas', () => {
    expect(
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], current: 113, delta: -2 }],
      }).changes[0]!.delta,
    ).toBe(-2);
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], delta: 0.5 }],
      }),
    ).toThrow();
  });

  it('requires complete change arithmetic to match current minus previous', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], delta: 4 }],
      }),
    ).toThrow();
  });

  it('requires retained partial and stale change arithmetic to remain coherent', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], availability: 'partial', delta: 999 }],
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [
          { ...completeOverview.changes[0], availability: 'stale', current: null, delta: 5 },
        ],
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [
          { ...completeOverview.changes[0], availability: 'partial', previous: null, delta: 5 },
        ],
      }),
    ).toThrow();

    const retained = OverviewReadModelV1Schema.parse({
      ...completeOverview,
      changes: [
        {
          ...completeOverview.changes[0],
          availability: 'stale',
          current: 113,
          previous: 115,
          delta: -2,
        },
      ],
    });
    expect(retained.changes[0]!.delta).toBe(-2);
  });

  it('enforces metric-key and unit compatibility', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        changes: [{ ...completeOverview.changes[0], unit: 'views' }],
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        trend: { ...completeOverview.trend, unit: 'count' },
      }),
    ).toThrow();
  });

  it('rejects duplicate and unresolved provenance references', () => {
    const duplicateReference = cloneCompleteOverview();
    duplicateReference.provenance.references.push({
      ...duplicateReference.provenance.references[0]!,
    });
    expect(() => OverviewReadModelV1Schema.parse(duplicateReference)).toThrow();

    const duplicateUse = cloneCompleteOverview();
    duplicateUse.changes[0]!.provenanceRefs.push(duplicateUse.changes[0]!.provenanceRefs[0]!);
    expect(() => OverviewReadModelV1Schema.parse(duplicateUse)).toThrow();

    const unresolved = cloneCompleteOverview();
    unresolved.briefing.provenanceRefs = ['briefing:missing'];
    expect(() => OverviewReadModelV1Schema.parse(unresolved)).toThrow();
  });

  it('rejects non-canonical timestamps and unknown availability states', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        asOf: '2026-08-10T00:05:00Z',
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({ ...completeOverview, availability: 'degraded' }),
    ).toThrow();
  });

  it('accepts only HTTP(S) evidence URLs', () => {
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        release: { ...completeOverview.release, evidenceUrl: 'file:///etc/passwd' },
      }),
    ).toThrow();
    expect(() =>
      OverviewReadModelV1Schema.parse({
        ...completeOverview,
        release: { ...completeOverview.release, evidenceUrl: 'javascript:alert(1)' },
      }),
    ).toThrow();
  });
});
