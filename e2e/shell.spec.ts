import { test, expect, SAMPLE_CURL, SAMPLE_CURL_GET } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * App shell: focus management, headings, labels. Everything is driven through the UI against the
 * mocked API from fixtures.ts.
 */

async function parseToEditor(page: Page) {
  await page.goto('/playground');
  await page.getByLabel('cURL command').fill(SAMPLE_CURL);
  await page.getByRole('button', { name: /Parse cURL/i }).click();
  await page.waitForURL(/\/editor/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Generate Code/i })).toBeVisible();
}

test.describe('Shell: labels, headings and focus', () => {
  test('Playground inputs have a visible label that names them', async ({ mockPage: page }) => {
    await page.goto('/playground');
    const textarea = page.getByRole('textbox', { name: 'cURL command' });
    await expect(textarea).toBeVisible();
    await expect(page.locator('label[for]', { hasText: 'cURL command' })).toBeVisible();

    await page.getByRole('button', { name: /Add another cURL/i }).click();
    await expect(page.getByRole('textbox', { name: 'cURL command 1' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'cURL command 2' })).toBeVisible();
  });

  test('after parsing, focus is on the single <h1> of /editor', async ({ mockPage: page }) => {
    await parseToEditor(page);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit Parsed Request');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('the empty editor and the batch editor each have exactly one <h1>', async ({ mockPage: page }) => {
    await page.goto('/editor');
    await expect(page.locator('h1')).toHaveCount(1);

    await page.goto('/playground');
    await page.getByRole('textbox', { name: 'cURL command' }).fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Add another cURL/i }).click();
    await page.getByRole('textbox', { name: 'cURL command 2' }).fill(SAMPLE_CURL_GET);
    await page.getByRole('button', { name: /Parse All/i }).click();
    await page.waitForURL(/\/batch-editor/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Generate All/i })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  for (const [name, button] of [
    ['Export', /^Export$/],
    ['Preview', /^Preview$/],
    ['Reset confirmation', /^Reset$/],
    ['Code generation', /Generate Code/],
  ] as const) {
    test(`${name} dialog returns focus to the button that opened it`, async ({ mockPage: page }) => {
      await parseToEditor(page);
      const opener = page.getByRole('button', { name: button });
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  }
});

test.describe('Unknown routes', () => {
  test('an unknown path shows a 404 page that links back to the Playground', async ({ mockPage: page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
    await page.getByRole('link', { name: /Go to the Playground/i }).click();
    await expect(page).toHaveURL(/\/playground$/);
    await expect(page.getByRole('heading', { level: 1, name: 'cURL Playground' })).toBeVisible();
  });
});
