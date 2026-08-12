import { defineConfig } from '@playwright/test';

const fixtureToken = 'ci-local-overview-token-0001';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /overview\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/fixture-api.mjs',
      port: 4100,
      reuseExistingServer: false,
      env: { E2E_FIXTURE_API_PORT: '4100', E2E_API_TOKEN: fixtureToken },
    },
    {
      command:
        'corepack pnpm --filter @public-operations-observatory/web dev --hostname 127.0.0.1 --port 3200',
      port: 3200,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        OBSERVATORY_API_BASE_URL: 'http://127.0.0.1:4100',
        OBSERVATORY_API_TOKEN: fixtureToken,
      },
    },
  ],
});
