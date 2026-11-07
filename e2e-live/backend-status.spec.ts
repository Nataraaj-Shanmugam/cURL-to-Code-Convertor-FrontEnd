import { test, expect, curlInput, setGatewayMode, SIMPLE_POST } from './support/live';

/**
 * Cold start. The gateway in front of the real backend answers like a sleeping Render service
 * (HTML 503) until it is woken; then every request reaches the backend again. This project runs
 * alone, after the rest of the suite (see playwright.live.config.ts), because sleep is global.
 */

test.describe.configure({ mode: 'serial' });

test.afterEach(async () => {
  await setGatewayMode('awake');
});

test('[BS-01] a fresh load goes checking → ready against the real backend', async ({ page }) => {
  await page.goto('/playground');
  const chip = page.getByTestId('backend-status-playground');
  await expect(chip).toHaveAttribute('data-status', 'ready');
  await expect(chip).toHaveText('Generator ready');
  await expect(page.getByTestId('backend-status-nav')).toHaveAttribute('data-status', 'ready');
});

test('[BS-02] asleep → waking: a parse is held, then sent once when the backend wakes', async ({ page, api }) => {
  await setGatewayMode('asleep');
  await page.goto('/playground');
  const chip = page.getByTestId('backend-status-playground');
  await expect(chip).toHaveAttribute('data-status', 'waking');
  await expect(chip).toHaveText('Generator waking up');

  await curlInput(page).fill(SIMPLE_POST);
  await page.getByRole('button', { name: 'Parse cURL' }).click();
  await expect(page.getByText('The generator is waking up — usually under a minute')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Waiting for the generator' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Waiting for generator/ })).toBeDisabled();
  await page.waitForTimeout(1_500);
  expect(api.of('/api/parse')).toHaveLength(0);
  expect(api.of('/api/health').length).toBeGreaterThan(1); // still polling

  await setGatewayMode('awake');
  await expect(page).toHaveURL(/\/editor$/, { timeout: 30_000 });
  await api.settle();
  expect(api.of('/api/parse')).toHaveLength(1);
  expect(api.of('/api/parse')[0]!.status).toBe(200);
  await expect(page.getByTestId('backend-status-nav')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByText('"asha@example.com"', { exact: true })).toBeVisible();
});

test('[BS-04] Cancel stops waiting; nothing is sent', async ({ page, api }) => {
  await setGatewayMode('asleep');
  await page.goto('/playground');
  await curlInput(page).fill(SIMPLE_POST);
  await page.getByRole('button', { name: 'Parse cURL' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('The generator is waking up — usually under a minute')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Parse cURL' })).toBeEnabled();
  await setGatewayMode('awake');
  await expect(page.getByTestId('backend-status-playground')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await page.waitForTimeout(500);
  expect(api.of('/api/parse')).toHaveLength(0);
  await expect(page).toHaveURL(/\/playground$/);
});

test('[BS-03] still asleep after the wake budget → unavailable; Retry once it is up', async ({ page }) => {
  test.setTimeout(120_000);
  await setGatewayMode('asleep');
  await page.clock.install(); // run the 90 s wake budget out without waiting for it
  await page.goto('/playground');
  const chip = page.getByTestId('backend-status-playground');
  await expect(chip).toHaveAttribute('data-status', 'waking');
  await expect
    .poll(async () => {
      await page.clock.runFor(10_000);
      return chip.getAttribute('data-status');
    }, { timeout: 60_000, intervals: [200] })
    .toBe('unavailable');
  await expect(chip).toHaveText(/Generator unavailable/);

  await curlInput(page).fill(SIMPLE_POST);
  await page.getByRole('button', { name: 'Parse cURL' }).click();
  await expect
    .poll(async () => {
      await page.clock.runFor(10_000);
      return page.getByText(/The generator didn't wake up/).first().isVisible();
    }, { timeout: 60_000, intervals: [200] })
    .toBe(true);
  const retryParse = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(retryParse).toBeVisible();

  await setGatewayMode('awake');
  await page.getByRole('button', { name: /Generator unavailable. Retry connecting/ }).first().click();
  await expect.poll(async () => {
    await page.clock.runFor(1_000);
    return chip.getAttribute('data-status');
  }, { timeout: 30_000, intervals: [200] }).toBe('ready');
  await retryParse.click();
  await expect.poll(async () => {
    await page.clock.runFor(500);
    return page.url();
  }, { timeout: 30_000, intervals: [200] }).toMatch(/\/editor$/);
});
