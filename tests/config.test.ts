import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('rejects path-like GitHub owner and repository values', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/observatory',
        OBSERVATORY_GITHUB_OWNER: '../escape',
        OBSERVATORY_GITHUB_REPOSITORY: 'project',
      }),
    ).toThrow();
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/observatory',
        OBSERVATORY_GITHUB_OWNER: 'owner',
        OBSERVATORY_GITHUB_REPOSITORY: '..',
      }),
    ).toThrow();
  });

  it('does not treat GitHub Actions metadata as collector configuration', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://localhost/observatory',
      GITHUB_REPOSITORY: 'Codename-11/public-operations-observatory',
    });

    expect(config.OBSERVATORY_GITHUB_OWNER).toBe('Codename-11');
    expect(config.OBSERVATORY_GITHUB_REPOSITORY).toBe('hermes-relay');
  });
});
