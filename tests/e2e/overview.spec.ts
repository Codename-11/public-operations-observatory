import { expect, test, type Page } from '@playwright/test';

const fixtureApi = `http://127.0.0.1:${process.env.E2E_FIXTURE_API_PORT ?? 4100}`;
const fixtureToken = 'ci-local-overview-token-0001';
const routes = {
  pulse: '/projects/hermes-relay',
  reach: '/projects/hermes-relay/reach-acquisition',
  delivery: '/projects/hermes-relay/delivery-sources',
} as const;

async function resetFixture(mode: 'complete' | 'partial' = 'complete') {
  const response = await fetch(`${fixtureApi}/__fixture/reset?mode=${mode}`, { method: 'POST' });
  expect(response.ok).toBe(true);
}

function observeBrowser(page: Page) {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('request', (request) => requests.push(request.url()));
  return { errors, requests };
}

async function expectNoOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(
      await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.clientWidth,
      })),
    );
}

async function expectHistorySummaryTextContained(page: Page) {
  const contained = await page.locator('.history-series-summary > div').evaluateAll((items) =>
    items.every((item) => {
      const parent = item.getBoundingClientRect();
      return [...item.children].every((child) => {
        const range = document.createRange();
        range.selectNodeContents(child);
        const text = range.getBoundingClientRect();
        return text.left >= parent.left - 1 && text.right <= parent.right + 1;
      });
    }),
  );
  expect(contained).toBe(true);
}

function expectCleanBrowser(observed: ReturnType<typeof observeBrowser>) {
  expect(observed.errors).toEqual([]);
  expect(
    observed.requests.some((url) =>
      /analytics|umami|plausible|google-analytics|segment/i.test(url),
    ),
  ).toBe(false);
}

test.beforeEach(async () => resetFixture());

test('Executive Pulse is the default route with exact facts, safe evidence, and server-only data access', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const observed = observeBrowser(page);
  await page.goto(routes.pulse, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Hermes-Relay decision layer' })).toBeVisible();
  await expect(page.locator('#executive-stars-title')).toHaveText('Stars');
  await expect(page.getByLabel('120')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Open issues' })).toBeVisible();
  await expect(page.locator('.data-surface-window')).toContainText('Current observation window');
  await expect(page.getByRole('link', { name: 'Current' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('4 minutes')).toBeVisible();
  await expect(page.locator('.magic-particles canvas')).toBeVisible();
  await expect(page.locator('.magic-border-beam')).toBeVisible();

  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('link', { name: 'Executive pulse' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(primary.getByRole('link', { name: 'Reach & acquisition' })).not.toHaveAttribute(
    'aria-current',
  );

  await page.getByRole('button', { name: 'Review evidence' }).click();
  const dialog = page.getByRole('dialog', { name: 'Evidence and provenance' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close evidence' })).toBeFocused();
  const evidence = dialog.getByRole('link', {
    name: 'Open observation:fixture-1 evidence on api.github.com (opens in a new tab)',
  });
  await expect(evidence).toHaveAttribute('target', '_blank');
  await expect(evidence).toHaveAttribute('rel', 'noopener noreferrer');

  const clientResources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  );
  expect(clientResources.some((url) => url.includes('127.0.0.1:4100'))).toBe(false);
  expect(JSON.stringify(clientResources)).not.toContain(fixtureToken);
  await expectNoOverflow(page);
  expectCleanBrowser(observed);

  const audit = (await (await fetch(`${fixtureApi}/__fixture/requests`)).json()) as {
    overviewRequests: Array<{
      authorization: string | null;
      accept: string | null;
      period: string | null;
      view: string | null;
    }>;
  };
  const expectedAuthorization = ['Bear', 'er ', fixtureToken].join('');
  expect(audit.overviewRequests).toEqual([
    {
      authorization: expectedAuthorization,
      accept: 'application/json',
      period: '7d',
      view: 'current',
    },
  ]);
});

test('Completed week remains available and Refresh now runs through the server boundary', async ({
  page,
}) => {
  await page.goto(routes.pulse, { waitUntil: 'domcontentloaded' });

  await page.getByRole('link', { name: 'Completed week' }).click();
  await expect(page).toHaveURL(/view=completed/);
  await expect(page.getByText(/Completed reporting window/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Completed week' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'Refresh now' }).click();
  await expect(
    page.getByText('Refresh completed with the latest source observations.'),
  ).toBeVisible();
  const audit = (await (await fetch(`${fixtureApi}/__fixture/requests`)).json()) as {
    refreshRequests: number;
  };
  expect(audit.refreshRequests).toBe(1);
});

test('Reach and acquisition presents independent exact signals without attribution claims', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const observed = observeBrowser(page);
  await page.goto(routes.reach, { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: 'Hermes-Relay repository signals' }),
  ).toBeVisible();
  const table = page.getByRole('table', {
    name: 'Exact independent aggregate repository signal values',
  });
  await expect(
    table.getByRole('row', { name: 'Page views views 60 50 +10 complete' }),
  ).toBeVisible();
  await expect(table.getByRole('row', { name: 'Clones clones 22 20 +2 complete' })).toBeVisible();
  await expect(table.getByRole('row', { name: 'Stars count 120 115 +5 complete' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Best-effort historical signals' })).toBeVisible();
  await expect(page.locator('.history-series-card')).toHaveCount(4);
  await expect(
    page.getByRole('img', { name: /Active-star cohort history.*1 to 120 count/i }),
  ).toBeVisible();
  await expect(page.getByText('People who later unstarred are absent.')).toBeVisible();
  await expect(page.getByText('Earlier traffic history is unavailable.')).toHaveCount(2);
  await expect(page.getByRole('main')).not.toContainText(/conversion|attribution|unique visitors/i);
  await expect(page.getByText('Scroll horizontally for all exact columns.')).toBeHidden();
  await expect(
    page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
      name: 'Reach & acquisition',
    }),
  ).toHaveAttribute('aria-current', 'page');
  await expectNoOverflow(page);
  expectCleanBrowser(observed);
});

test('Delivery and sources exposes exact intervals, release context, and source evidence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const observed = observeBrowser(page);
  await page.goto(routes.delivery, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Hermes-Relay release delivery' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'v1.2.3' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Release asset downloads data' });
  await expect(table.getByRole('row', { name: /4 Aug 2026 0 complete/ })).toBeVisible();
  await expect(page.getByLabel('Observed interval total').getByLabel('19')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source freshness and status' })).toBeVisible();
  await expect(page.locator('.magic-animated-grid-pattern')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
      name: 'Delivery & sources',
    }),
  ).toHaveAttribute('aria-current', 'page');
  await expectNoOverflow(page);
  expectCleanBrowser(observed);
});

test('tablet navigation exposes all supported routes and tracks the active surface', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });

  const destinations = [
    [routes.pulse, 'Executive pulse'],
    [routes.reach, 'Reach & acquisition'],
    [routes.delivery, 'Delivery & sources'],
  ] as const;

  for (const [route, activeLabel] of destinations) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.desktop-sidebar')).toBeHidden();
    await expect(page.locator('.tablet-navigation')).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Tablet primary' });
    for (const [href, label] of destinations) {
      await expect(navigation.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    await expect(navigation.getByRole('link', { name: activeLabel })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectNoOverflow(page);
  }
});

for (const width of [390, 320]) {
  test(`mobile ${width}px navigation and all data routes have no overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const observed = observeBrowser(page);

    for (const route of Object.values(routes)) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.desktop-sidebar')).toBeHidden();
      await expect(page.locator('.tablet-navigation')).toBeHidden();
      await expectNoOverflow(page);
      if (route === routes.reach) {
        await expect(page.getByText('Scroll horizontally for all exact columns.')).toBeVisible();
        await expectHistorySummaryTextContained(page);
      }
    }

    await page.goto(routes.pulse, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Observatory navigation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await expect(dialog.getByRole('link', { name: 'Reach & acquisition' })).toHaveAttribute(
      'href',
      routes.reach,
    );
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expectCleanBrowser(observed);
  });
}

test('partial fixture keeps retained Reach facts and marks the unavailable current observation', async ({
  page,
}) => {
  await resetFixture('partial');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(routes.reach, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Partial overview')).toBeVisible();
  const views = page.getByLabel('Page views metric');
  await expect(views.getByText('Unavailable')).toHaveCount(2);
  await expect(views.getByText('50')).toBeVisible();
  await expect(page.getByLabel('Stars metric').getByLabel('120')).toBeVisible();
});

test('reduced motion disables repeated motion while preserving exact values', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(routes.delivery, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: 'Review evidence' })).toHaveCSS(
    'transition-duration',
    '1e-05s',
  );
  await expect(page.getByLabel('31').first()).toHaveText('31');
  await expect(page.locator('.magic-border-beam > div')).toHaveCSS('offset-distance', '0%');
  await expectNoOverflow(page);
});
