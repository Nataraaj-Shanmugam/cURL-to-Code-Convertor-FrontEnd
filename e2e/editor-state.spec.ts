import { test, expect, SAMPLE_CURL_STRING_BODY } from './fixtures';
import type { Page } from '@playwright/test';

async function openEditorWithStringBody(page: Page) {
  await page.goto('/playground');
  await page.locator('textarea').fill(SAMPLE_CURL_STRING_BODY);
  await page.getByRole('button', { name: /Parse cURL/i }).click();
  await page.waitForURL(/\/editor/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Delete name' }).first()).toBeVisible();
}

/** Fires beforeunload like the browser does and reports whether the page asked to block it. */
const unloadIsBlocked = (page: Page) =>
  page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

const deleteBodyField = (page: Page) =>
  page.getByRole('button', { name: 'Delete name' }).first().click();

test.describe('Editor change tracking (JSON-string body)', () => {
  test('an untouched string body does not warn on unload and shows no "modified" change', async ({ mockPage: page }) => {
    await openEditorWithStringBody(page);

    expect(await unloadIsBlocked(page)).toBe(false);
    // Review Changes is unavailable until something changes: nothing is "modified" yet.
    await expect(page.getByRole('button', { name: /Changes/i })).toBeDisabled();
  });

  test('after one edit the unload warning arms and Review Changes lists only that edit', async ({ mockPage: page }) => {
    await openEditorWithStringBody(page);

    await deleteBodyField(page);
    await expect.poll(() => unloadIsBlocked(page)).toBe(true);

    await page.getByRole('button', { name: /Changes/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Review Changes' });
    await expect(dialog.getByRole('row')).toHaveCount(2); // header + one change
    await expect(dialog.getByRole('cell', { name: 'data.name' })).toBeVisible();
    await expect(dialog.getByText('removed', { exact: true })).toBeVisible();
    await expect(dialog.getByText('modified', { exact: true })).toHaveCount(0);
  });

  test('Reset restores the body and disarms the unload warning', async ({ mockPage: page }) => {
    await openEditorWithStringBody(page);
    await deleteBodyField(page);
    await expect.poll(() => unloadIsBlocked(page)).toBe(true);

    await page.getByRole('button', { name: /^Reset$/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Delete name' }).first()).toBeVisible();
    await expect.poll(() => unloadIsBlocked(page)).toBe(false);
  });

  test('body edits stay local when the backend body endpoints fail', async ({ mockPage: page }) => {
    await page.route(/\/api\/body\/(edit|delete)/, route => route.fulfill({ status: 500, json: { success: false } }));
    await openEditorWithStringBody(page);

    await deleteBodyField(page);

    await expect(page.getByRole('button', { name: 'Delete name' })).toHaveCount(0);
    await expect(page.getByText(/Body API error/i)).toHaveCount(0);
  });
});

test.describe('Editor navigation guard', () => {
  test('leaving without edits is not intercepted (Back button)', async ({ mockPage: page }) => {
    await openEditorWithStringBody(page);
    await page.getByRole('button', { name: /← Back/i }).click();
    await expect(page).toHaveURL(/\/playground/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Back with edits shows one confirm dialog: Keep editing stays, Discard leaves', async ({ mockPage: page }) => {
    await openEditorWithStringBody(page);
    await deleteBodyField(page);
    await expect.poll(() => unloadIsBlocked(page)).toBe(true);

    await page.getByRole('button', { name: /← Back/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Discard unsaved edits?' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page).toHaveURL(/\/editor/);

    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.getByRole('button', { name: 'Delete name' })).toHaveCount(0); // edit kept

    await page.getByRole('button', { name: /← Back/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard and leave' }).click();
    await expect(page).toHaveURL(/\/playground/);
  });

  test('a nav-bar link and browser Back are guarded too; Escape means stay', async ({ mockPage: page }) => {
    await openEditorWithStringBody(page);
    await deleteBodyField(page);
    await expect.poll(() => unloadIsBlocked(page)).toBe(true);

    await page.getByRole('link', { name: 'Playground' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Discard unsaved edits?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/editor/);

    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Discard unsaved edits?' })).toBeVisible();
    await expect(page).toHaveURL(/\/editor/);
    await page.getByRole('button', { name: 'Discard and leave' }).click();
    await expect(page).toHaveURL(/\/playground/);
  });
});
