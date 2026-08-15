import { describe, expect, it } from 'vitest';

import {
  HistoricalContextReadModelV1Schema,
  HistoricalContextRequestSchema,
} from '../src/history.js';

const history = {
  version: 1,
  project: {
    key: 'hermes-relay',
    name: 'Hermes-Relay',
    repository: 'Codename-11/hermes-relay',
    scope: 'Codename-11/hermes-relay',
  },
  period: '180d',
  window: {
    start: '2026-02-16T00:00:00.000Z',
    end: '2026-08-15T12:00:00.000Z',
  },
  asOf: '2026-08-15T12:00:00.000Z',
  series: [
    [
      'github.stars',
      'Active-star cohort',
      'count',
      'calendar-month-end',
      'lower-bound',
      'reconstructed-lower-bound',
    ],
    [
      'github.open_issues',
      'Open issues',
      'count',
      'calendar-month-end',
      'reconstructed',
      'reconstructed',
    ],
    ['github.views', 'Page views', 'views', 'utc-day', 'observed', 'source-rolling-window'],
    [
      'github.clones',
      'Repository clones',
      'clones',
      'utc-day',
      'observed',
      'source-rolling-window',
    ],
  ].map(([metricKey, label, unit, bucket, method, reasonCode]) => ({
    metricKey,
    label,
    unit,
    bucket,
    method,
    availability: 'unavailable',
    limitation: 'Source-specific limitation.',
    reasonCode,
    evidenceUrl: null,
    points: [],
  })),
  provenance: {
    scope: 'Codename-11/hermes-relay',
    generatedAt: '2026-08-15T12:00:00.000Z',
    references: [],
  },
};

describe('HistoricalContextReadModelV1', () => {
  it('accepts only the explicit 180-day request contract', () => {
    expect(
      HistoricalContextRequestSchema.parse({ projectKey: 'hermes-relay', period: '180d' }),
    ).toEqual({ projectKey: 'hermes-relay', period: '180d' });
    expect(
      HistoricalContextRequestSchema.safeParse({ projectKey: 'hermes-relay', period: '7d' })
        .success,
    ).toBe(false);
  });

  it('accepts four source-specific history series', () => {
    expect(HistoricalContextReadModelV1Schema.safeParse(history).success).toBe(true);
  });

  it('rejects unknown fields and unresolved provenance references', () => {
    expect(HistoricalContextReadModelV1Schema.safeParse({ ...history, history: [] }).success).toBe(
      false,
    );
    const invalid = {
      ...history,
      series: history.series.map((series, index) =>
        index === 0
          ? {
              ...series,
              points: [
                {
                  timestamp: '2026-04-30T00:00:00.000Z',
                  value: 12,
                  availability: 'partial',
                  provenanceRefs: ['record:missing'],
                },
              ],
            }
          : series,
      ),
    };
    expect(HistoricalContextReadModelV1Schema.safeParse(invalid).success).toBe(false);
  });
});
