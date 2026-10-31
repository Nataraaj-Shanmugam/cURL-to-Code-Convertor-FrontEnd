import { test, expect, MOCK_PARSED_CURL } from './fixtures';

const TOKEN = 'sk_live_PLAYWRIGHT_BEARER_9f8e7d6c5b4a';
const COOKIE = 'playwright-cookie-value-123';
const STORAGE_KEY = 'curlcraft_editor_state';

const CURL = `curl -X POST "https://api.example.com/users" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -b "session_id=${COOKIE}" -d '{"name": "John"}'`;

/** Everything either storage holds, as one string. */
async function dumpStorage(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const dump = (s: Storage) => Object.keys(s).map((k) => `${k}=${s.getItem(k)}`).join('\n');
    return { local: dump(localStorage), session: dump(sessionStorage) };
  });
}

test.describe('Secrets are not persisted', () => {
  test.beforeEach(async ({ mockPage: page }) => {
    // The backend echoes the pasted credentials back, as the real parser does.
    await page.route(/\/api\/parse$/, (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            ...MOCK_PARSED_CURL,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
            cookies: { session_id: COOKIE },
          },
        },
      }),
    );
    await page.goto('/playground');
    await page.locator('textarea').fill(CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });
  });

  test('no token or cookie value appears in localStorage or sessionStorage after parsing', async ({ mockPage: page }) => {
    // Wait until the editor has saved its state, so the assertion below is not vacuous.
    await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).not.toBeNull();

    const { local, session } = await dumpStorage(page);
    for (const secret of [TOKEN, COOKIE]) {
      expect(local).not.toContain(secret);
      expect(session).not.toContain(secret);
    }
    expect(local).not.toContain(STORAGE_KEY);
    expect(session).toContain('[REDACTED]');
    // The router's copy of the navigation payload (kept by the browser across reloads) is redacted too.
    const historyState = await page.evaluate(() => JSON.stringify(window.history.state));
    expect(historyState).not.toContain(TOKEN);
    // Non-secret parts are still saved so a reload can restore the request.
    expect(session).toContain('api.example.com');
  });

  test('the editor masks the token on screen until it is revealed', async ({ mockPage: page }) => {
    await expect(page.getByText(`Bearer ••••••••`).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(TOKEN);

    const reveal = page.getByRole('button', { name: 'Reveal value of Authorization' });
    await reveal.click();
    await expect(reveal).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toContainText(TOKEN);
  });

  test('a reload restores a redacted request and asks for the secrets again', async ({ mockPage: page }) => {
    await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).not.toBeNull();
    // The reload warning is a native dialog; accept it.
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto('/editor'); // fresh navigation: no router state, so the saved copy is used

    await expect(page.getByRole('alert').filter({ hasText: /redacted when it was saved/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Redacted: re-enter value').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(TOKEN);
  });

  test('"Clear saved request" empties the saved copy', async ({ mockPage: page }) => {
    await page.getByRole('button', { name: 'Clear saved request' }).click();
    await expect(page.getByText(/Saved copy cleared/)).toBeVisible();
    expect(await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).toBeNull();
  });

  test('"Clear saved request" also stops a reload or Forward from restoring the request', async ({ mockPage: page }) => {
    await page.getByRole('button', { name: 'Clear saved request' }).click();
    await expect(page.getByText(/Reloading this page will not restore this request/)).toBeVisible();
    page.on('dialog', (dialog) => void dialog.accept());
    await page.reload();
    await expect(page.getByText('No cURL command parsed yet')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => JSON.stringify(window.history.state))).not.toContain('api.example.com/users');
  });

  test('browser Back/Forward restores the live values; Generate Code sends no placeholder', async ({ mockPage: page }) => {
    await expect.poll(() => page.evaluate(() => JSON.stringify(window.history.state))).toContain('[REDACTED]');
    await page.goBack();
    await expect(page).toHaveURL(/\/playground/);
    await page.goForward();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.getByRole('alert').filter({ hasText: /redacted when it was saved/i })).toHaveCount(0);

    const generate = page.waitForRequest(/\/api\/generate-from-parsed/);
    await page.getByRole('button', { name: 'Generate Code' }).click();
    await page.locator('#option-full').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Generate Code' }).click();
    const body = (await generate).postData() ?? '';
    expect(body).toContain(TOKEN);
    expect(body).not.toContain('[REDACTED]');
  });

  test('after a reload only redacted values exist: Generate Code is blocked until they are re-entered', async ({ mockPage: page }) => {
    await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).not.toBeNull();
    page.on('dialog', (dialog) => void dialog.accept());
    await page.reload();
    const generate = page.getByRole('button', { name: 'Generate Code' });
    await expect(generate).toBeDisabled({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/Re-enter 2 redacted values to generate code/);
  });

  test('an old localStorage entry is deleted on load', async ({ mockPage: page }) => {
    await page.evaluate(
      ([k, token]) => localStorage.setItem(k!, JSON.stringify({ parsed: { method: 'GET', base_url: 'https://x.test', endpoint: '/', headers: { Authorization: `Bearer ${token}` } } })),
      [STORAGE_KEY, TOKEN],
    );
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto('/playground');
    const { local, session } = await dumpStorage(page);
    expect(local).not.toContain(TOKEN);
    expect(local).not.toContain(STORAGE_KEY);
    expect(session).not.toContain(TOKEN);
  });
});
