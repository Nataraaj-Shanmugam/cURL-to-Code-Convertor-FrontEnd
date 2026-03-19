import { test, expect, SAMPLE_CURL, SAMPLE_CURL_GET } from './fixtures';

test.describe('Playground Page', () => {
  test.beforeEach(async ({ mockPage: page }) => {
    await page.goto('/playground');
  });

  // ── Layout & initial state ────────────────────────────────────────────────

  test('renders playground header and empty textarea', async ({ mockPage: page }) => {
    await expect(page.getByRole('heading', { name: /cURL Playground/i })).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue('');
  });

  test('shows example cURL cards when textarea is empty', async ({ mockPage: page }) => {
    await expect(page.getByText('Try an example:')).toBeVisible();
    await expect(page.getByText('GET Request')).toBeVisible();
    await expect(page.getByText('POST with JSON Body')).toBeVisible();
  });

  test('Parse button is disabled when textarea is empty', async ({ mockPage: page }) => {
    const parseBtn = page.getByRole('button', { name: /Parse cURL/i });
    await expect(parseBtn).toBeDisabled();
  });

  test('Reset button is disabled when textarea is empty (single entry)', async ({ mockPage: page }) => {
    const resetBtn = page.getByRole('button', { name: /Reset/i });
    await expect(resetBtn).toBeDisabled();
  });

  // ── Single cURL flow ─────────────────────────────────────────────────────

  test('enables Parse button after typing a cURL', async ({ mockPage: page }) => {
    await page.locator('textarea').fill(SAMPLE_CURL);

    const parseBtn = page.getByRole('button', { name: /Parse cURL/i });
    await expect(parseBtn).toBeEnabled();
  });

  test('hides examples after filling textarea', async ({ mockPage: page }) => {
    await page.locator('textarea').fill(SAMPLE_CURL);
    await expect(page.getByText('Try an example:')).not.toBeVisible();
  });

  test('clicking example populates textarea', async ({ mockPage: page }) => {
    await page.getByText('GET Request').click();

    const textarea = page.locator('textarea');
    await expect(textarea).not.toHaveValue('');
    const value = await textarea.inputValue();
    expect(value).toContain('GET');
  });

  test('Parse cURL navigates to /editor', async ({ mockPage: page }) => {
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();

    // Navigation to editor (loading state may be too fast to catch)
    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });
  });

  test('shows error for invalid cURL', async ({ mockPage: page }) => {
    await page.locator('textarea').fill('invalid-curl-garbage');
    await page.getByRole('button', { name: /Parse cURL/i }).click();

    // Use exact text to avoid matching the sr-only live region too
    await expect(page.getByText('Invalid cURL command format', { exact: true })).toBeVisible();
    // Should stay on playground
    await expect(page).toHaveURL(/\/playground/);
  });

  test('Reset clears textarea and error', async ({ mockPage: page }) => {
    await page.locator('textarea').fill('invalid-curl-garbage');
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect(page.getByText('Invalid cURL command format', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Reset/i }).click();
    await expect(page.locator('textarea')).toHaveValue('');
    await expect(page.getByText('Invalid cURL command format', { exact: true })).not.toBeVisible();
  });

  test('Ctrl+Enter keyboard shortcut triggers parse', async ({ mockPage: page }) => {
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.keyboard.press('Control+Enter');

    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });
  });

  // ── Multi-cURL (batch) flow ───────────────────────────────────────────────

  test('"Add another cURL" adds a second textarea', async ({ mockPage: page }) => {
    await page.getByText('Add another cURL').click();

    const textareas = page.locator('textarea');
    await expect(textareas).toHaveCount(2);
  });

  test('multi-mode shows command counter', async ({ mockPage: page }) => {
    await page.getByText('Add another cURL').click();
    await expect(page.getByText(/2 commands/i)).toBeVisible();
  });

  test('multi-mode shows "Parse All" button', async ({ mockPage: page }) => {
    await page.getByText('Add another cURL').click();
    await page.locator('textarea').first().fill(SAMPLE_CURL);
    await page.locator('textarea').nth(1).fill(SAMPLE_CURL_GET);

    await expect(page.getByRole('button', { name: /Parse All \(2\)/i })).toBeVisible();
  });

  test('Parse All navigates to /batch-editor', async ({ mockPage: page }) => {
    await page.getByText('Add another cURL').click();
    await page.locator('textarea').first().fill(SAMPLE_CURL);
    await page.locator('textarea').nth(1).fill(SAMPLE_CURL_GET);

    await page.getByRole('button', { name: /Parse All/i }).click();
    await expect(page).toHaveURL(/\/batch-editor/, { timeout: 10_000 });
  });

  test('removing a multi-entry goes back to single mode', async ({ mockPage: page }) => {
    await page.getByText('Add another cURL').click();
    await expect(page.locator('textarea')).toHaveCount(2);

    // Hover over the second entry's card to reveal the close button
    const secondCard = page.locator('textarea').nth(1).locator('..');
    await secondCard.hover();
    // Click the X button
    const closeBtn = page.locator('[title="Remove this cURL"]').first();
    await closeBtn.click();

    await expect(page.locator('textarea')).toHaveCount(1);
    // Should no longer show multi-mode counter
    await expect(page.getByText(/commands/i)).not.toBeVisible();
  });

  // ── Import dialog ─────────────────────────────────────────────────────────

  test('Import button opens import dialog', async ({ mockPage: page }) => {
    await page.getByRole('button', { name: /Import/i }).click();
    // Dialog should appear with import-related content
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
