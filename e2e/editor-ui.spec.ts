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

// QU-2 / QU-26 / T59: focused row actions are visible; accordion triggers get the teal ring.
test('a keyboard-focused Edit button is visible and triggers show the brand focus ring', async ({ mockPage: page }) => {
  await openEditor(page);
  const edit = page.getByRole('button', { name: 'Edit Content-Type' });
  await edit.focus();
  await expect(edit.locator('..')).toHaveCSS('opacity', '1');

  const trigger = page.getByRole('button', { name: 'Headers', exact: true });
  await trigger.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(trigger).toBeFocused();
  const shadow = await trigger.evaluate(el => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe('none');
});

test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('row Edit / Delete actions are shown without hover', async ({ mockPage: page }) => {
    await openEditor(page);
    const isHoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches);
    test.skip(!isHoverNone, 'this browser does not report (hover: none) under touch emulation');
    await expect(page.getByRole('button', { name: 'Edit Content-Type' }).locator('..')).toHaveCSS('opacity', '1');
  });
});
