import { describe, expect, it } from 'vitest';

import { dayBucket, digestPayload } from '../src/domain/observation.js';

describe('observation identity', () => {
  it('produces the same digest for objects with different key order', () => {
    expect(digestPayload({ stars: 12, nested: { forks: 3, open: 2 } })).toBe(
      digestPayload({ nested: { open: 2, forks: 3 }, stars: 12 }),
    );
  });

  it('normalizes observation timestamps to UTC day buckets', () => {
    expect(dayBucket(new Date('2026-08-11T23:41:12-04:00')).toISOString()).toBe(
      '2026-08-12T00:00:00.000Z',
    );
  });
});
