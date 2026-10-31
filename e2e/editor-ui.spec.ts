import { test, expect, SAMPLE_CURL, MOCK_PARSED_CURL } from './fixtures';
import type { Page } from '@playwright/test';

/** Parse through the Playground; `data` overrides the mocked /api/parse result. */
async function openEditor(page: Page, data: Record<string, unknown> = MOCK_PARSED_CURL) {
  await page.route(/\/api\/parse$/, route => route.fulfill({ json: { success: true, data } }));
  await page.goto('/playground');
  await page.locator('textarea').first().fill(SAMPLE_CURL);
  await page.getByRole('button', { name: /Parse cURL/i }).click();
  await page.waitForURL(/\/editor/, { timeout: 10_000 });
  await expect(page.getByText('Edit Parsed Request')).toBeVisible();
}

// QF-1 / T58: a request with almost every section missing gives the longest Add Section list.
for (const size of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`Add Section list opens inside the viewport and scrolls at ${size.width}x${size.height}`, async ({ mockPage: page }) => {
    await page.setViewportSize(size);
    await openEditor(page, { method: 'GET', url: 'https://api.example.com/users', base_url: 'https://api.example.com', endpoint: '/users' });

    await page.getByRole('button', { name: /Add Section/ }).click();
    await page.getByRole('dialog').getByRole('combobox').click();

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const box = (await listbox.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);

    // The first and the last option can both be reached and clicked with the mouse.
    const first = page.getByRole('option', { name: 'Query Parameters' });
    const firstBox = (await first.boundingBox())!;
    expect(firstBox.y).toBeGreaterThanOrEqual(0);

    const last = page.getByRole('option').last();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(async () => {
      await page.mouse.wheel(0, 400);
      const lastBox = (await last.boundingBox())!;
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(size.height);
      expect(lastBox.y).toBeGreaterThanOrEqual(box.y - 1);
    }).toPass({ timeout: 5_000 });
    const lastName = (await last.textContent())!;
    await last.click();
    await expect(page.getByRole('dialog').getByRole('combobox')).toHaveText(lastName);
  });
}
