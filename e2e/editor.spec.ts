import { test, expect, SAMPLE_CURL, MOCK_PARSED_CURL } from './fixtures';

/** Helper: navigate through playground → parse → arrive at /editor */
async function navigateToEditor(page: import('@playwright/test').Page) {
  await page.goto('/playground');
  await page.locator('textarea').fill(SAMPLE_CURL);
  await page.getByRole('button', { name: /Parse cURL/i }).click();
  await page.waitForURL(/\/editor/, { timeout: 10_000 });
}

/**
 * Ensure an accordion section is open, by its title text.
 *
 * The editor picks its initially-open sections in a mount effect, so the first
 * `data-state` we observe can be stale: reading it once and clicking would then
 * close a section that was just opened. Re-read the state on every attempt and
 * only finish once the section reports `open`.
 */
async function expandSection(page: import('@playwright/test').Page, title: string) {
  const trigger = page.locator('button[data-state]', { hasText: title }).first();
  await expect(async () => {
    if ((await trigger.getAttribute('data-state')) === 'closed') await trigger.click();
    await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

test.describe('Editor Page', () => {
  // ── Empty state ───────────────────────────────────────────────────────────

  test('shows empty state when navigating directly to /editor', async ({ mockPage: page }) => {
    await page.goto('/editor');

    await expect(page.getByText(/No cURL command parsed yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Go to Playground/i })).toBeVisible();
  });

  test('empty state "Go to Playground" navigates back', async ({ mockPage: page }) => {
    await page.goto('/editor');
    await page.getByRole('button', { name: /Go to Playground/i }).click();

    await expect(page).toHaveURL(/\/playground/);
  });

  // ── Loaded editor ─────────────────────────────────────────────────────────

  test('displays parsed request data after parsing', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    // Should show the method and endpoint
    await expect(page.getByText('POST').first()).toBeVisible();
    await expect(page.getByText(MOCK_PARSED_CURL.endpoint).first()).toBeVisible();
    await expect(page.getByText(MOCK_PARSED_CURL.base_url).first()).toBeVisible();
  });

  test('shows original cURL command', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    await expect(page.getByText(/curl -X POST/i).first()).toBeVisible();
  });

  test('toolbar buttons are visible', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    await expect(page.getByRole('button', { name: /Generate Code/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Back/i }).or(page.locator('button:has-text("←")'))).toBeVisible();
  });

  test('displays headers section with parsed headers', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    await expandSection(page, 'Headers');
    await expect(page.getByText('Content-Type').first()).toBeVisible();
  });

  test('displays query params section', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    await expandSection(page, 'Query Parameters');

    // The field keys should be visible after expanding
    await expect(page.getByText(/\bpage\b/).first()).toBeVisible({ timeout: 5_000 });
  });

  test('displays cookies section', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    await expandSection(page, 'Cookies');
    await expect(page.getByText(/session_id/).first()).toBeVisible({ timeout: 5_000 });
  });

  test('displays request body section with nested data', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    // Body section uses a different accordion item with value="data"
    const bodyTrigger = page.locator('button[data-state]', { hasText: /Request Body|Body/i }).first();
    if (await bodyTrigger.isVisible()) {
      const state = await bodyTrigger.getAttribute('data-state');
      if (state === 'closed') {
        await bodyTrigger.click();
        await page.waitForTimeout(400);
      }
      await expect(page.getByText('name').first()).toBeVisible();
    }
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('Back button returns to playground', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    const backBtn = page.getByRole('button', { name: /Back/i }).or(page.locator('button:has-text("←")'));
    await backBtn.first().click();

    await expect(page).toHaveURL(/\/playground/);
  });

  // ── Export ────────────────────────────────────────────────────────────────

  test('Export button triggers download', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    const exportBtn = page.getByRole('button', { name: /Export/i });
    if (await exportBtn.isVisible()) {
      // Export opens a preview (secrets masked) with the download button inside.
      await exportBtn.click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Download JSON/i }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.json');
    }
  });

  // ── Preview dialog ────────────────────────────────────────────────────────

  test('Preview button opens request preview dialog', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    const previewBtn = page.getByRole('button', { name: /Preview/i });
    if (await previewBtn.isVisible()) {
      await previewBtn.click();

      await expect(
        page.getByText(/POST/i).first().or(page.getByText(MOCK_PARSED_CURL.base_url).first()),
      ).toBeVisible();
    }
  });

  // ── Editor persistence ────────────────────────────────────────────────────

  test('editor state persists via sessionStorage, redacted, and not via localStorage', async ({ mockPage: page }) => {
    await navigateToEditor(page);

    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('curlcraft_editor_state'))).not.toBeNull();
    const stored = await page.evaluate(() => sessionStorage.getItem('curlcraft_editor_state'));
    const entry = JSON.parse(stored!);
    expect(entry.parsed).toBeTruthy();
    expect(stored).toContain('[REDACTED]');
    expect(await page.evaluate(() => localStorage.getItem('curlcraft_editor_state'))).toBeNull();
  });
});
