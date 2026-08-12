import { expect, test, type Page } from '@playwright/test';

const fixtureApi = 'http://127.0.0.1:4100';
const fixtureToken = 'ci-local-overview-token-0001';
const overviewPath = '/projects/hermes-relay';

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

test.beforeEach(async () => resetFixture());

test('desktop Overview has exact contract labels, zero bar, safe evidence and no client data leaks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const observed = observeBrowser(page);
  await page.goto(overviewPath, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'Hermes-Relay public operations' })).toBeVisible();
  await expect(page.locator('.desktop-sidebar')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(
    page.locator('.desktop-sidebar [aria-disabled="true"]').filter({ hasText: /^Attention/ }),
  ).toHaveAttribute('aria-disabled', 'true');
  const table = page.getByRole('table', { name: 'Release asset downloads data' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'downloads' })).toBeVisible();
  await expect(table.getByRole('row', { name: /4 Aug 2026 0 complete/ })).toBeVisible();
  await expect(page.locator('.trend-bar').first()).toHaveCSS('height', '0px');

  await page.getByRole('button', { name: 'Review evidence' }).click();
  const dialog = page.getByRole('dialog', { name: 'Evidence and provenance' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close evidence' })).toBeFocused();
  const evidence = dialog.getByRole('link', {
    name: 'Open observation:fixture-1 evidence on api.github.com (opens in a new tab)',
  });
  await expect(evidence).toHaveText('Open evidence on api.github.com');
  await expect(evidence).toHaveAttribute('target', '_blank');
  await expect(evidence).toHaveAttribute('rel', 'noopener noreferrer');
  let externalNavigation = false;
  await page.route('https://api.github.com/**', async (route) => {
    externalNavigation = true;
    await route.abort();
  });
  await evidence.click();
  expect(externalNavigation).toBe(false);

  const clientResources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  );
  expect(clientResources.some((url) => url.includes('127.0.0.1:4100'))).toBe(false);
  expect(JSON.stringify(clientResources)).not.toContain(fixtureToken);
  expect(
    observed.requests.some((url) =>
      /analytics|umami|plausible|google-analytics|segment/i.test(url),
    ),
  ).toBe(false);
  expect(observed.errors).toEqual([]);
  await expectNoOverflow(page);

  const audit = (await (await fetch(`${fixtureApi}/__fixture/requests`)).json()) as {
    overviewRequests: Array<{
      authorization: string | null;
      accept: string | null;
      period: string | null;
    }>;
  };
  expect(audit.overviewRequests).toEqual([
    { authorization: `Bearer ${fixtureToken}`, accept: 'application/json', period: '7d' },
  ]);
});

test('tablet uses top navigation without sidebar and has no horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const observed = observeBrowser(page);
  await page.goto(overviewPath, { waitUntil: 'networkidle' });
  await expect(page.locator('.desktop-sidebar')).toBeHidden();
  await expect(page.locator('.tablet-navigation')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Tablet primary' })).toBeVisible();
  await expectNoOverflow(page);
  expect(observed.errors).toEqual([]);
});

for (const width of [390, 320]) {
  test(`mobile ${width}px navigation sheet, keyboard focus and overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const observed = observeBrowser(page);
    await page.goto(overviewPath, { waitUntil: 'networkidle' });
    await expect(page.locator('.desktop-sidebar')).toBeHidden();
    await expect(page.locator('.tablet-navigation')).toBeHidden();

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Observatory navigation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await expect(
      dialog.locator('[aria-disabled="true"]').filter({ hasText: /^Settings/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await expectNoOverflow(page);
    expect(observed.errors).toEqual([]);
  });
}

test('partial fixture renders an honest banner while retaining supported content', async ({
  page,
}) => {
  await resetFixture('partial');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(overviewPath, { waitUntil: 'networkidle' });
  await expect(page.getByText('Partial Overview')).toBeVisible();
  await expect(page.getByText('Page views unavailable')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'v1.2.3' })).toBeVisible();
});

test('reduced motion removes meaningful transition duration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(overviewPath, { waitUntil: 'networkidle' });
  const button = page.getByRole('button', { name: 'Review evidence' });
  await expect(button).toHaveCSS('transition-duration', '1e-05s');
  await expectNoOverflow(page);
});
