import type { Page, Route } from '@playwright/test';
import { test, expect, SAMPLE_CURL } from './fixtures';

/**
 * The hosted backend sleeps when idle. These tests replace the always-healthy health mock with
 * one the test controls, then check the app-level status and the held parse.
 */
async function controlHealth(page: Page) {
  const health = { up: false, calls: 0 };
  // Registered after mockApi's handler, so it takes precedence.
  await page.route(/\/api\/health/, (route: Route) => {
    health.calls += 1;
    return health.up
      ? route.fulfill({ json: { status: 'ok' } })
      : route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>503 Service Unavailable</h1>' });
  });
  return health;
}

test.describe('Backend status and cold start', () => {
  test('asleep → waking → ready: a parse requested while waking is held, then sent', async ({ mockPage: page }) => {
    const health = await controlHealth(page);
    let parseRequests = 0;
    page.on('request', (req) => {
      if (/\/api\/parse$/.test(req.url())) parseRequests += 1;
    });

    // Deep link: the check must start without visiting Home first.
    await page.goto('/playground');
    const chip = page.getByTestId('backend-status-playground');
    await expect(chip).toHaveAttribute('data-status', 'waking');
    await expect(chip).toHaveText('Generator waking up');
    await expect(page.getByTestId('backend-status-nav')).toHaveAttribute('data-status', 'waking');

    // The playground stays usable while waking.
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect(page.getByText('The generator is waking up — usually under a minute')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Waiting for the generator' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Waiting for generator/i })).toBeDisabled();
    expect(parseRequests).toBe(0);

    health.up = true;
    await expect(page).toHaveURL(/\/editor/, { timeout: 15_000 });
    expect(parseRequests).toBe(1);
    expect(health.calls).toBeGreaterThan(1);
    await expect(page.getByTestId('backend-status-nav')).toHaveAttribute('data-status', 'ready');
  });

  test('unavailable → Retry → ready', async ({ mockPage: page }) => {
    const health = await controlHealth(page);
    // Fake timers so the 90 s wake budget can run out without waiting for it.
    await page.clock.install();
    await page.goto('/playground');

    const chip = page.getByTestId('backend-status-playground');
    await expect(chip).toHaveAttribute('data-status', 'waking');
    await expect
      .poll(
        async () => {
          await page.clock.runFor(15_000);
          return chip.getAttribute('data-status');
        },
        { timeout: 20_000, intervals: [50] },
      )
      .toBe('unavailable');
    await expect(chip).toHaveText(/Generator unavailable.*Retry/);

    // A parse now starts a fresh check; when that also gives up it explains in plain words and offers Retry.
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect
      .poll(
        async () => {
          await page.clock.runFor(15_000);
          return page.getByText(/The generator didn't wake up/).first().isVisible();
        },
        { timeout: 20_000, intervals: [50] },
      )
      .toBe(true);
    const retryParse = page.getByRole('button', { name: 'Retry', exact: true });
    await expect(retryParse).toBeVisible();

    health.up = true;
    await page.getByRole('button', { name: /Generator unavailable. Retry connecting/ }).first().click();
    await expect(chip).toHaveAttribute('data-status', 'ready');
    await expect(chip).toHaveText('Generator ready');

    await retryParse.click();
    await expect(page).toHaveURL(/\/editor/);
  });

  test('the waking indicator does not animate with reduced motion', async ({ mockPage: page }) => {
    await controlHealth(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/playground');

    const chip = page.getByTestId('backend-status-playground');
    await expect(chip).toHaveAttribute('data-status', 'waking');
    const animation = await chip.locator('span[aria-hidden="true"]').evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
  });
});
