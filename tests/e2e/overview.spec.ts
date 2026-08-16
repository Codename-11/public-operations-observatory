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

  const main = page.getByRole('main');
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(main.getByRole('heading', { name: 'Executive pulse', level: 1 })).toBeVisible();
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);

  const facts = main.locator('.executive-pulse__fact-card');
  await expect(facts).toHaveCount(4);
  const stars = facts.filter({ has: page.getByRole('heading', { name: 'Stars' }) });
  const openIssues = facts.filter({ has: page.getByRole('heading', { name: 'Open issues' }) });
  await expect(stars).toHaveCount(1);
  await expect(stars.locator('.executive-pulse__fact-number')).toHaveText('120');
  await expect(openIssues).toHaveCount(1);
  await expect(openIssues.locator('.executive-pulse__fact-number')).toHaveText('8');

  await expect(main.locator('.executive-pulse__status')).toBeVisible();
  await expect(main.locator('.executive-pulse__status-copy')).toContainText(
    /collection|evidence|signal/i,
  );
  await expect(main.getByRole('heading', { name: 'Decision brief' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Evidence health' })).toBeVisible();

  const attention = main.locator('.executive-pulse__attention-list');
  const attentionRows = attention.locator('.executive-pulse__attention-row');
  const attentionLabels = await attentionRows.locator('strong').allTextContents();
  expect(new Set(attentionLabels).size).toBe(attentionLabels.length);
  for (const label of attentionLabels) {
    await expect(attention.getByText(label, { exact: true })).toHaveCount(1);
  }

  await expect(main).not.toContainText(/github\.[a-z_]+/i);
  await expect(main.locator('.magic-particles, .magic-border-beam')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Current' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Completed week' })).toBeVisible();

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
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
    1000,
  );
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

  await page.getByRole('button', { name: 'Refresh data' }).click();
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

  await expect(page.getByRole('heading', { name: 'Reach & acquisition' })).toBeVisible();
  await expect(page.locator('.reach-metric__card')).toHaveCount(4);
  const table = page.getByRole('table', {
    name: 'Exact current-window repository signal values',
  });
  await expect(table.getByRole('row', { name: 'Page views 60 50 Latest snapshot' })).toBeVisible();
  await expect(
    table.getByRole('row', { name: 'Repository clones 22 20 Latest snapshot' }),
  ).toBeVisible();
  await expect(table.getByRole('row', { name: 'Stars 120 115 Latest snapshot' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signal history' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Stars history.*1.*120/i })).toBeVisible();
  await expect(page.getByText('People who later unstarred are absent.')).toBeVisible();
  await expect(page.getByText('Earlier traffic history is unavailable.')).toHaveCount(2);
  await expect(page.getByRole('main')).not.toContainText(/conversion|attribution|unique visitors/i);
  await expect(page.getByText('Swipe to view prior values and coverage.')).toBeHidden();
  await expect(
    page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
      name: 'Reach & acquisition',
    }),
  ).toHaveAttribute('aria-current', 'page');
  await expectNoOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
    1000,
  );
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
    await resetFixture('partial');
    await page.setViewportSize({ width, height: 844 });
    const observed = observeBrowser(page);

    for (const route of Object.values(routes)) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.desktop-sidebar')).toBeHidden();
      await expect(page.locator('.tablet-navigation')).toBeHidden();
      await expectNoOverflow(page);
      if (route === routes.pulse) {
        await expect(page.locator('.executive-pulse__status')).toBeVisible();
        await expect(page.locator('.executive-pulse__fact-card')).toHaveCount(4);
        const mobileAttention = page.locator('.executive-pulse__attention-list');
        await expect(mobileAttention.getByText('Page views', { exact: true })).toHaveCount(1);
        const columns = await page
          .locator('.executive-pulse__fact-grid')
          .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
        expect(columns).toBe(width === 390 ? 2 : 1);
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight),
        ).toBeLessThanOrEqual(width === 390 ? 2200 : 2600);
      }
      if (route === routes.reach) {
        await expect(page.getByText('Swipe to view prior values and coverage.')).toBeVisible();
        await expect(page.locator('.reach-metric__card')).toHaveCount(4);
        const columns = await page
          .locator('.reach-dashboard__metric-grid')
          .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
        expect(columns).toBe(width === 390 ? 2 : 1);
      }
    }

    await page.goto(routes.pulse, { waitUntil: 'domcontentloaded' });
    const touchTargets = page.locator(
      '.executive-pulse .reach-command a:visible, .executive-pulse .reach-command button:visible, .executive-pulse .ui-evidence-link:visible',
    );
    expect(await touchTargets.count()).toBeGreaterThan(0);
    for (const box of await touchTargets.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    )) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

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

  const views = page.getByRole('region', { name: /Page views metric/i });
  await expect(views.locator('.reach-metric__value')).toHaveText('Unavailable');
  await expect(views.getByText('Comparison unavailable')).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Exact current-window repository signal values' })
      .getByRole('row', { name: 'Page views Unavailable 50 Unavailable' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: /Stars metric/i }).getByText('120')).toBeVisible();
});

test('reduced motion disables repeated motion while preserving exact values', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(routes.pulse, { waitUntil: 'domcontentloaded' });

  const pulse = page.locator('.executive-pulse');
  await expect(pulse).toBeVisible();
  await expect(pulse.locator('.executive-pulse__fact-card')).toHaveCount(4);
  await expect(pulse.locator('.executive-pulse__workspace')).toBeVisible();
  await expect(pulse.locator('.magic-particles, .magic-border-beam')).toHaveCount(0);
  const motionSensitiveStyles = await pulse
    .locator(
      '.executive-pulse__status, .executive-pulse__fact-card, .executive-pulse__workspace, .executive-pulse__decision-row, .executive-pulse__attention-row, .executive-pulse__health-row',
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          opacity: style.opacity,
          visibility: style.visibility,
          transform: style.transform,
          filter: style.filter,
        };
      }),
    );
  expect(
    motionSensitiveStyles.every(
      ({ opacity, visibility, transform, filter }) =>
        opacity !== '0' && visibility !== 'hidden' && transform === 'none' && filter === 'none',
    ),
  ).toBe(true);
  await expectNoOverflow(page);

  await page.goto(routes.delivery, { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('button', { name: 'Review evidence' })).toHaveCSS(
    'transition-duration',
    '1e-05s',
  );
  await expect(page.getByLabel('31').first()).toHaveText('31');
  await expect(page.locator('.magic-border-beam > div')).toHaveCSS('offset-distance', '0%');
  await expectNoOverflow(page);

  await page.goto(routes.reach, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: /Stars metric/i }).getByText('120')).toBeVisible();
  await expect(
    page.getByRole('region', { name: /Page views metric/i }).getByText('60'),
  ).toBeVisible();
});
