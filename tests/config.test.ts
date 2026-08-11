import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('rejects path-like GitHub owner and repository values', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/observatory',
        GITHUB_OWNER: '../escape',
        GITHUB_REPOSITORY: 'project',
      }),
    ).toThrow();
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/observatory',
        GITHUB_OWNER: 'owner',
        GITHUB_REPOSITORY: '..',
      }),
    ).toThrow();
  });
});
