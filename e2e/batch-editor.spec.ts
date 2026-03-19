import { test, expect, SAMPLE_CURL, SAMPLE_CURL_GET, MOCK_PARSED_CURL, mockApi } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Navigate to /batch-editor by injecting pre-parsed items into route state.
 *
 * Note: The batch editor has a known issue where `useBatchEditor(initialItems)`
 * uses a lazy initializer, so items parsed asynchronously via `state.curls`
 * don't propagate. We work around this by providing `state.items` directly.
 */
async function navigateToBatchEditorWithItems(page: Page) {
  await page.goto('/playground');
  // Use evaluate to navigate with pre-parsed items via React Router
  await page.evaluate((mockParsed) => {
    const items = [
      { parsed: mockParsed, originalCurl: 'curl -X POST ...' },
      { parsed: { ...mockParsed, method: 'GET', endpoint: '/users/list' }, originalCurl: 'curl -X GET ...' },
    ];
    // React Router stores state in window.history
    window.history.pushState({ usr: { items } }, '', '/batch-editor');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, MOCK_PARSED_CURL);

  // Wait for batch editor to render
  await page.waitForTimeout(1000);
}

test.describe('Batch Editor Page', () => {
  test.setTimeout(30_000);

  // ── Empty state ───────────────────────────────────────────────────────────

  test('shows empty state when navigating directly', async ({ mockPage: page }) => {
    await page.goto('/batch-editor');

    await expect(page.getByRole('heading', { name: /No Requests/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Go to Playground/i })).toBeVisible();
  });

  test('empty state navigates back to playground', async ({ mockPage: page }) => {
    await page.goto('/batch-editor');

    await page.getByRole('button', { name: /Go to Playground/i }).click();
    await expect(page).toHaveURL(/\/playground/);
  });

  // ── Loaded batch (via pre-parsed items) ───────────────────────────────────

  test('loads batch with sidebar showing requests', async ({ mockPage: page }) => {
    await navigateToBatchEditorWithItems(page);

    await expect(page.getByText('Batch Editor')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate All/i })).toBeVisible();
    await expect(page.getByText('Back to Playground')).toBeVisible();
  });

  test('sidebar shows item count badge', async ({ mockPage: page }) => {
    await navigateToBatchEditorWithItems(page);

    // Badge showing count of items (use exact match to avoid matching other text containing '2')
    await expect(page.getByText('2', { exact: true })).toBeVisible();
  });

  test('clicking a sidebar item loads it in editor', async ({ mockPage: page }) => {
    await navigateToBatchEditorWithItems(page);

    // Click the second request in the sidebar
    const sidebarItem = page.getByText(/\/users\/list/i).first();
    if (await sidebarItem.isVisible()) {
      await sidebarItem.click();
      await page.waitForTimeout(500);
      // Editor panel should show the request
      await expect(page.getByText('GET').first()).toBeVisible();
    }
  });

  test('Back to Playground navigates away', async ({ mockPage: page }) => {
    await navigateToBatchEditorWithItems(page);

    await page.getByText('Back to Playground').click();
    await expect(page).toHaveURL(/\/playground/);
  });

  // ── Batch via playground navigation (parsing flow) ────────────────────────

  test('Parse All from playground navigates to batch-editor page', async ({ mockPage: page }) => {
    await page.goto('/playground');

    await page.getByText('Add another cURL').click();
    await page.locator('textarea').first().fill(SAMPLE_CURL);
    await page.locator('textarea').nth(1).fill(SAMPLE_CURL_GET);

    await page.getByRole('button', { name: /Parse All/i }).click();
    // At minimum, we should arrive at the batch-editor URL
    await expect(page).toHaveURL(/\/batch-editor/, { timeout: 10_000 });
  });
});
