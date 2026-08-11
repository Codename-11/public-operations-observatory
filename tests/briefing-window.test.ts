import { describe, expect, it } from 'vitest';

import { latestCompletedUtcWeekEnd } from '../src/briefing/window.js';

describe('latestCompletedUtcWeekEnd', () => {
  it('anchors the default window to Monday 00:00 UTC', () => {
    expect(latestCompletedUtcWeekEnd(new Date('2026-08-11T17:30:00-04:00')).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z',
    );
    expect(latestCompletedUtcWeekEnd(new Date('2026-08-10T15:00:00Z')).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z',
    );
  });
});
