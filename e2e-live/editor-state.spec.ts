import type { Page } from '@playwright/test';
import {
  test,
  expect,
  parseToEditor,
  openSection,
  openCodegen,
  generate,
  shownCode,
  clipboard,
  downloadText,
  unloadIsBlocked,
  SECRETS,
  SIMPLE_POST,
} from './support/live';

/**
 * Review Changes, Reset, Preview, Export, secret handling, the saved copy and the unsaved-edits
 * guard, on a request parsed by the real backend.
 */

const STORAGE_KEY = 'curlcraft_editor_state';

/** A login call carrying every kind of secret: bearer token, API key, cookie and a password in the body. */
const LOGIN = `curl -X POST "https://auth.example.com/v1/login?client=web" -H "Authorization: Bearer ${SECRETS.bearer}" -H "X-API-Key: ${SECRETS.apiKey}" -H "Content-Type: application/json" -b "sid=${SECRETS.cookie}" -d '{"username":"asha","password":"${SECRETS.password}","remember":true}'`;
const ALL_SECRETS = Object.values(SECRETS);

async function dumpStorage(page: Page) {
  return page.evaluate(() => {
    const dump = (s: Storage) => Object.keys(s).map((k) => `${k}=${s.getItem(k)}`).join('\n');
    return { local: dump(localStorage), session: dump(sessionStorage), history: JSON.stringify(window.history.state) };
  });
}

test.describe('Review Changes and Reset', () => {
  test('[ED-16] Review Changes lists every change; a row can be reverted; Raw JSON shows both sides', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    const changes = page.getByRole('button', { name: 'Changes' });
    await expect(changes).toBeDisabled();

    await page.getByRole('button', { name: 'Edit name', exact: true }).click();
    await page.getByRole('textbox', { name: 'Value of name' }).fill('Meera');
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    await page.getByRole('button', { name: 'Delete age', exact: true }).click();
    await page.getByRole('button', { name: 'Add Entry to Headers' }).click();
    await page.locator('#add-entry-key').fill('X-Trace');
    await page.locator('#add-entry-value').fill('t-1');
    await page.getByRole('dialog').getByRole('button', { name: 'Add Entry' }).click();

    await changes.click();
    const dialog = page.getByRole('dialog', { name: 'Review Changes' });
    await expect(dialog.getByRole('row')).toHaveCount(4); // header + 3 changes
    const row = (path: string) => dialog.getByRole('row').filter({ has: page.getByRole('cell', { name: path, exact: true }) });
    await expect(row('data.name')).toContainText('modified');
    await expect(row('data.name')).toContainText('Meera');
    await expect(row('data.age')).toContainText('removed');
    await expect(row('headers.X-Trace')).toContainText('added');

    await row('data.age').getByRole('button', { name: 'Revert change' }).click();
    await expect(dialog.getByRole('row')).toHaveCount(3);

    await dialog.getByRole('tab', { name: 'Raw JSON' }).click();
    await expect(dialog).toContainText('"name": "Asha"');
    await expect(dialog).toContainText('"name": "Meera"');
    // The token is masked in both panes.
    await expect(dialog).not.toContainText(SECRETS.bearer);
    await page.keyboard.press('Escape');
    await expect(page.getByText('31', { exact: true })).toBeVisible(); // age is back
  });

  test('[ED-17] Reset asks first; Cancel keeps the edits, Reset restores the parsed request', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    await page.getByRole('button', { name: 'Delete Section Headers' }).click();
    await page.getByRole('dialog', { name: 'Delete section?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: /^Headers/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Reset all changes?' });
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: /^Headers/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await confirm.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Headers/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Changes' })).toBeDisabled();
    expect(await unloadIsBlocked(page)).toBe(false);
  });
});

test.describe('Preview and Export', () => {
  test('[ED-18] Request Preview shows the full request and copies the reconstructed cURL, redacted unless asked', async ({ page, context, api }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await parseToEditor(page, LOGIN);
    await page.getByRole('button', { name: 'Preview' }).click();
    const dialog = page.getByRole('dialog', { name: 'Request Preview' });
    await expect(dialog.getByText('POST', { exact: true })).toBeVisible();
    await expect(dialog).toContainText('https://auth.example.com/v1/login?client=web');
    await expect(dialog).not.toContainText(SECRETS.bearer);

    await openSection(dialog, /^Reconstructed cURL/);
    await expect(dialog.getByText(SECRETS.bearer)).toHaveCount(0); // masked on screen
    // Copy gives the working command by default; ticking "Redact secrets when copying" redacts it.
    const redactCopy = dialog.getByRole('checkbox', { name: 'Redact secrets when copying' });
    await expect(redactCopy).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Copy cURL' }).click();
    const raw = await clipboard(page);
    expect(raw).toContain(SECRETS.bearer);
    expect(raw).toContain(SECRETS.password);

    await redactCopy.click();
    await dialog.getByRole('button', { name: /Copy cURL|Copied/ }).click();
    await expect.poll(() => clipboard(page)).not.toBe(raw);
    const redacted = await clipboard(page);
    expect(redacted).toContain('https://auth.example.com/v1/login?client=web');
    for (const s of ALL_SECRETS) expect(redacted).not.toContain(s);
    expect(redacted).toContain('[REDACTED]');

    // The reconstructed command is a real cURL: the backend parses it back to the same request.
    const res = await page.request.post(`${process.env.E2E_LIVE_BACKEND}/api/parse`, { data: { curl: raw } });
    const reparsed = (await res.json()).data;
    const [original] = api.of('/api/parse');
    const first = (original!.response as { data: Record<string, unknown> }).data;
    expect(reparsed.method).toBe(first.method);
    expect(reparsed.url).toBe(first.url);
    expect(reparsed.headers).toEqual(first.headers);
    expect(JSON.parse(reparsed.data)).toEqual(JSON.parse(first.data as string));
  });

  test('[ED-19][ED-20] Export: masked preview, redacted file by default, raw file only when asked', async ({ page }) => {
    await parseToEditor(page, LOGIN);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export JSON' });
    const redact = dialog.getByRole('checkbox', { name: 'Redact secrets in the downloaded file' });
    await expect(redact).toBeChecked();
    await expect(redact).toBeFocused();
    for (const s of ALL_SECRETS) await expect(dialog).not.toContainText(s);

    // Reveal one secret on screen.
    const secrets = dialog.getByRole('region', { name: 'Secret values' });
    await expect(secrets).toContainText(/\d secret values are hidden below/);
    await secrets.getByRole('button', { name: 'Reveal value of headers.X-API-Key' }).click();
    await expect(dialog).toContainText(SECRETS.apiKey);
    await expect(dialog).not.toContainText(SECRETS.bearer);

    const [redactedFile] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download JSON' }).click()]);
    expect(redactedFile.suggestedFilename()).toMatch(/^parsed-curl-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.redacted\.json$/);
    const redactedText = await downloadText(redactedFile);
    for (const s of ALL_SECRETS) expect(redactedText).not.toContain(s);
    const redactedJson = JSON.parse(redactedText);
    expect(redactedJson.headers.Authorization).toContain('[REDACTED]');
    expect(redactedJson.url).toBe('https://auth.example.com/v1/login?client=web');
    await expect(page.getByText(/parsed-curl-.*\.redacted\.json/).last()).toBeVisible(); // toast names the file

    await redact.click();
    await expect(dialog).toContainText('The file will contain the real secret values.');
    const [rawFile] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download JSON' }).click()]);
    expect(rawFile.suggestedFilename()).toMatch(/^parsed-curl-[\dT-]+\.json$/);
    expect(rawFile.suggestedFilename()).not.toContain('redacted');
    const raw = JSON.parse(await downloadText(rawFile));
    expect(raw.headers.Authorization).toBe(`Bearer ${SECRETS.bearer}`);
    expect(raw.cookies.sid).toBe(SECRETS.cookie);

    // Closing resets the choice to the safe default.
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Redact secrets in the downloaded file' })).toBeChecked();
  });
});

test.describe('Secrets', () => {
  test('[ED-21][ED-26] secrets are masked until revealed; the Original cURL card copies a redacted command', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await parseToEditor(page, LOGIN);
    for (const s of ALL_SECRETS) await expect(page.locator('main')).not.toContainText(s);
    await expect(page.getByText('(secrets redacted when saved)')).toHaveCount(0); // a live parse is not redacted

    await page.getByRole('button', { name: 'Reveal value of Authorization' }).click();
    await expect(page.getByRole('button', { name: 'Reveal value of Authorization' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('main')).toContainText(SECRETS.bearer);
    await page.getByRole('button', { name: 'Reveal value of password' }).click();
    await expect(page.locator('main')).toContainText(SECRETS.password);
    await expect(page.locator('main')).not.toContainText(SECRETS.apiKey); // others stay masked

    await page.getByRole('button', { name: 'Copy original cURL command (secrets redacted)' }).click();
    const copied = await clipboard(page);
    expect(copied).toContain('https://auth.example.com/v1/login?client=web');
    for (const s of ALL_SECRETS) expect(copied).not.toContain(s);
  });

  test('[ED-22] the saved copy holds no secret; a reload restores it and asks for the secrets again', async ({ page, api }) => {
    await parseToEditor(page, LOGIN);
    await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).not.toBeNull();
    await expect(page.getByText(/A copy of this request, with secrets redacted/)).toBeVisible();
    const before = await dumpStorage(page);
    for (const s of ALL_SECRETS) {
      expect(before.local).not.toContain(s);
      expect(before.session).not.toContain(s);
      expect(before.history).not.toContain(s);
    }
    expect(before.session).toContain('auth.example.com');

    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Secret values in this request were redacted when it was saved.' })).toBeVisible();
    await expect(page.getByText('(secrets redacted when saved)')).toBeVisible();
    const generateBtn = page.getByRole('button', { name: 'Generate Code', exact: true });
    await expect(generateBtn).toBeDisabled();
    const alert = page.getByRole('alert').filter({ hasText: /Re-enter \d+ redacted values? to generate code/ });
    const count = Number((await alert.innerText()).match(/Re-enter (\d+)/)![1]);
    expect(count).toBeGreaterThanOrEqual(4);
    // Ctrl+G is blocked too.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Control+g');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Re-enter every redacted value; then generation works and uses the new values.
    const fresh: Record<string, string> = {
      Authorization: 'Bearer reentered-token-001',
      'X-API-Key': 'reentered-key-002',
      sid: 'reentered-cookie-003',
      password: 'reentered-pass-004',
    };
    await openSection(page, /^Cookies/);
    for (const [label, value] of Object.entries(fresh)) {
      await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
      await page.getByRole('textbox', { name: `Value of ${label}` }).fill(value);
      await page.getByRole('button', { name: `Save ${label}`, exact: true }).click();
    }
    await expect(page.locator('main span:text-is("Redacted: re-enter value")')).toHaveCount(0);
    // BUG-E2E-07: the hidden data_raw copy of the body still holds a placeholder, so Generate stays
    // disabled; deleting the bogus "Data Raw" section is the only way out.
    await page.getByRole('button', { name: 'Delete Section Data Raw' }).click();
    await page.getByRole('dialog', { name: 'Delete section?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(generateBtn).toBeEnabled();
    await openCodegen(page);
    await page.locator('#option-full').check();
    await generate(page);
    await api.settle();
    const sent = api.of('/api/generate-from-parsed')[0]!.rawBody;
    expect(sent).not.toContain('[REDACTED]');
    for (const value of Object.values(fresh)) expect(sent).toContain(value);
  });

  test('[ED-22] after a reload, re-entering every field marked "re-enter" unblocks Generate (BUG-E2E-07)', async ({ page }) => {
    test.fail(true, 'BUG-E2E-07: a redacted copy of the body in data_raw keeps Generate Code disabled after every marked field is re-entered');
    await parseToEditor(page, LOGIN);
    await expect.poll(() => page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).not.toBeNull();
    await page.reload();
    await openSection(page, /^Cookies/);
    for (const label of ['Authorization', 'X-API-Key', 'sid', 'password']) {
      await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
      await page.getByRole('textbox', { name: `Value of ${label}` }).fill(`new-${label}`);
      await page.getByRole('button', { name: `Save ${label}`, exact: true }).click();
    }
    await expect(page.locator('main span:text-is("Redacted: re-enter value")')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Generate Code', exact: true })).toBeEnabled({ timeout: 3_000 });
  });

  test('[ED-23] Clear saved request: nothing is kept and a reload has nothing to restore', async ({ page }) => {
    await parseToEditor(page, LOGIN);
    await page.getByRole('button', { name: 'Clear saved request' }).click();
    await expect(page.getByText('Saved copy cleared. Reloading this page will not restore this request.')).toBeVisible();
    expect(await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)).toBeNull();
    // An edit after clearing does not bring the saved copy back.
    await page.getByRole('button', { name: 'Delete remember', exact: true }).click();
    page.on('dialog', (d) => void d.accept());
    await page.reload();
    await expect(page.getByText('No cURL command parsed yet')).toBeVisible();
    expect((await dumpStorage(page)).history).not.toContain('auth.example.com');
  });
});

test.describe('Unsaved-edits guard', () => {
  test('[ED-24] untouched: leaving is free; after an edit Back, nav links and browser Back ask first', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    expect(await unloadIsBlocked(page)).toBe(false);
    await page.goBack();
    await expect(page).toHaveURL(/\/playground$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goForward(); // the live request comes back from memory
    await expect(page).toHaveURL(/\/editor$/);
    await page.getByRole('button', { name: 'Delete email', exact: true }).click();
    await expect.poll(() => unloadIsBlocked(page)).toBe(true);

    await page.getByRole('button', { name: '← Back' }).click();
    const guard = page.getByRole('dialog', { name: 'Discard unsaved edits?' });
    await expect(guard).toBeVisible();
    await guard.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/editor$/);
    await expect(page.getByText('"asha@example.com"', { exact: true })).toHaveCount(0);

    await page.getByRole('banner').getByRole('link', { name: 'Home' }).click();
    await expect(guard).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/editor$/);

    await page.goBack();
    await expect(guard).toBeVisible();
    await guard.getByRole('button', { name: 'Discard and leave' }).click();
    await expect(page).toHaveURL(/\/playground$/);
  });

  test('[ED-24] undoing every edit disarms the guard', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    await page.getByRole('button', { name: 'Delete email', exact: true }).click();
    await expect.poll(() => unloadIsBlocked(page)).toBe(true);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => unloadIsBlocked(page)).toBe(false);
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(page).toHaveURL(/\/playground$/);
  });
});

test.describe('Generated code keeps secrets off the screen', () => {
  test('[CG-15] generated Java is masked on screen and can be revealed', async ({ page }) => {
    await parseToEditor(page, LOGIN);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await generate(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Secrets are masked on screen.')).toBeVisible();
    for (const s of ALL_SECRETS) expect(await shownCode(page)).not.toContain(s);
    await dialog.getByRole('button', { name: 'Reveal value of generated code' }).click();
    await expect(dialog.getByText('Secrets are visible on screen.')).toBeVisible();
    expect(await shownCode(page)).toContain(SECRETS.bearer);
  });
});
