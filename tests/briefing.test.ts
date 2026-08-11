import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveBriefingOutputPath } from '../src/briefing/generate.js';

describe('resolveBriefingOutputPath', () => {
  it('contains path-like scopes beneath the configured output directory', () => {
    const root = path.resolve('.test-output');
    const output = resolveBriefingOutputPath(
      root,
      'x/../../../../etc/pwn',
      new Date('2026-08-12T00:00:00Z'),
    );

    expect(path.relative(root, output)).not.toMatch(/^\.\.(?:[/\\]|$)/);
    expect(path.dirname(output)).toBe(root);
  });
});
