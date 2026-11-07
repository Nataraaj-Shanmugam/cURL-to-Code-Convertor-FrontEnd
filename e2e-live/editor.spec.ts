import type { Page } from '@playwright/test';
import {
  test,
  expect,
  parseToEditor,
  openSection,
  openCodegen,
  generate,
  shownCode,
  ApiLog,
  CHROME_BASH,
  DOTTED_KEYS,
  INSECURE_GET,
  SIMPLE_POST,
  XML_PUT,
} from './support/live';

/**
 * Editing a parsed request. Each edit is checked twice: on screen, and in what the real backend
 * receives and generates from it (the parsed_data sent to /api/generate-from-parsed and the Java
 * that comes back).
 */

interface Parsed {
  method: string;
  url: string;
  endpoint: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  cookies?: Record<string, string>;
  data?: unknown;
  [key: string]: unknown;
}

/** Generate a full test class from the current request; returns what was sent and the Java shown. */
async function generateNow(page: Page, api: ApiLog): Promise<{ sent: Parsed; code: string }> {
  const before = api.of('/api/generate-from-parsed').length;
  await openCodegen(page);
  await page.locator('#option-full').check();
  await generate(page);
  await api.settle();
  const calls = api.of('/api/generate-from-parsed');
  expect(calls.length).toBe(before + 1);
  const code = await shownCode(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return { sent: (calls.at(-1)!.body as { parsed_data: Parsed }).parsed_data, code };
}

/** Edit a field by its label; `nth` picks among same-named fields (e.g. `qty` in each array item). */
async function editField(page: Page, label: string, value: string, nth = 0) {
  await page.getByRole('button', { name: `Edit ${label}`, exact: true }).nth(nth).click();
  await page.getByRole('textbox', { name: `Value of ${label}`, exact: true }).fill(value);
  await page.getByRole('button', { name: `Save ${label}`, exact: true }).click();
  await expect(page.getByRole('textbox', { name: `Value of ${label}`, exact: true })).toHaveCount(0);
}

async function addEntry(page: Page, section: string, key: string, value: string) {
  await page.getByRole('button', { name: `Add Entry to ${section}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Add New Entry' });
  await dialog.locator('#add-entry-key').fill(key);
  await dialog.locator('#add-entry-value').fill(value);
  return dialog;
}

test.describe('Editor: sections and fields', () => {
  test('[ED-01] sections, counts and required fields come from the real parse', async ({ page }) => {
    await parseToEditor(page, CHROME_BASH);
    await expect(page.getByRole('button', { name: /^Request Details/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Headers/ }).getByLabel('6 entries')).toBeAttached();
    await expect(page.getByRole('button', { name: /^Query Parameters/ }).getByLabel('2 entries')).toBeAttached();
    await expect(page.getByRole('button', { name: /^Cookies/ }).getByLabel('2 entries')).toBeAttached();
    await expect(page.getByRole('button', { name: /^Request Body/ }).getByLabel('4 entries')).toBeAttached();
    // method / url / base_url / endpoint are required: editable, never deletable or selectable.
    const details = page.getByRole('region', { name: /^Request Details/ });
    for (const field of ['method', 'url', 'base_url', 'endpoint']) {
      await expect(details.getByRole('button', { name: `Edit ${field}`, exact: true })).toBeAttached();
      await expect(details.getByRole('button', { name: `Delete ${field}`, exact: true })).toHaveCount(0);
      await expect(details.getByRole('checkbox', { name: `Select ${field} for deletion` })).toBeDisabled();
    }
  });

  test('[ED-29] only request sections are shown, not backend bookkeeping fields (BUG-E2E-03)', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    await expect(page.getByRole('button', { name: /^Request Body/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Data Raw/ })).toHaveCount(0, { timeout: 2_000 });
    await expect(page.getByRole('button', { name: /^Data Type/ })).toHaveCount(0, { timeout: 2_000 });
  });

  test('[ED-02][ED-03][ED-21][CG-21] editing and deleting headers changes what is generated', async ({ page, api }) => {
    await parseToEditor(page, CHROME_BASH);
    await editField(page, 'accept-language', 'ta-IN');
    await expect(page.getByText('ta-IN', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete origin', exact: true }).click();
    await expect(page.getByText('origin', { exact: true })).toHaveCount(0);

    const { sent, code } = await generateNow(page, api);
    expect(sent.headers!['accept-language']).toBe('ta-IN');
    expect(sent.headers).not.toHaveProperty('origin');
    expect(code).toContain('"accept-language", "ta-IN"');
    expect(code).not.toContain('https://shop.example.com');
  });

  test('[ED-04] Add Entry adds a header; an existing name (any case) asks before replacing', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    let dialog = await addEntry(page, 'Headers', 'X-Request-Id', 'req-123');
    await dialog.getByRole('button', { name: 'Add Entry' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('X-Request-Id', { exact: true })).toBeVisible();

    dialog = await addEntry(page, 'Headers', 'content-type', 'application/vnd.api+json');
    await dialog.getByRole('button', { name: 'Add Entry' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('"Content-Type" already exists (header names ignore case). Replace it with "content-type"?');
    await dialog.getByRole('button', { name: 'Replace' }).click();
    await expect(dialog).toBeHidden();

    const { sent, code } = await generateNow(page, api);
    expect(sent.headers).toMatchObject({ 'X-Request-Id': 'req-123', 'content-type': 'application/vnd.api+json' });
    expect(sent.headers).not.toHaveProperty('Content-Type');
    expect(code).toContain('"X-Request-Id", "req-123"');
  });

  test('[ED-05] a key that would corrupt the request is refused; Add is disabled without a key', async ({ page }) => {
    await parseToEditor(page, SIMPLE_POST);
    const dialog = await addEntry(page, 'Headers', '', 'x');
    await expect(dialog.getByRole('button', { name: 'Add Entry' })).toBeDisabled();
    await dialog.locator('#add-entry-key').fill('__proto__');
    await dialog.getByRole('button', { name: 'Add Entry' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('"__proto__" can\'t be used as a key.');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('[ED-06] Delete Section asks first; Cancel keeps it, Delete removes it from the request', async ({ page, api }) => {
    await parseToEditor(page, CHROME_BASH);
    await page.getByRole('button', { name: 'Delete Section Cookies' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete section?' });
    await expect(confirm).toContainText('The "Cookies" section and all its entries will be permanently removed.');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: /^Cookies/ })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Section Cookies' }).click();
    await page.getByRole('dialog', { name: 'Delete section?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: /^Cookies/ })).toHaveCount(0);

    const { sent, code } = await generateNow(page, api);
    expect(sent.cookies ?? {}).toEqual({});
    expect(code).not.toContain('session_id');
  });

  test('[ED-07] Add Section offers only missing sections; a new section takes entries', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await page.getByRole('button', { name: /^Add Section/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Missing Section' });
    await dialog.getByRole('combobox').click();
    await expect(page.getByRole('option', { name: 'Headers', exact: true })).toHaveCount(0); // already there
    await page.getByRole('option', { name: 'Query Parameters' }).click();
    await dialog.getByRole('button', { name: 'Add Section' }).click();
    await expect(page.getByText('No entries yet.')).toBeVisible();

    const add = await addEntry(page, 'Query Parameters', 'include', 'profile');
    await add.getByRole('button', { name: 'Add Entry' }).click();
    const { sent, code } = await generateNow(page, api);
    expect(sent.query_params).toEqual({ include: 'profile' });
    expect(code).toContain('queryParam("include", "profile")');
  });

  test('[ED-08] the endpoint and method can be edited; the generated call follows', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await editField(page, 'endpoint', '/v2/users');
    await editField(page, 'method', 'PUT');
    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('PUT')).toBeVisible();
    const { sent, code } = await generateNow(page, api);
    expect(sent).toMatchObject({ method: 'PUT', endpoint: '/v2/users' });
    expect(code).toContain('.put("/v2/users")');
  });

  test('[ED-09] body leaves keep their JSON type; leaves and array items can be deleted', async ({ page, api }) => {
    await parseToEditor(page, CHROME_BASH);
    await editField(page, 'qty', '5', 0); // first item's qty: a number stays a number
    await editField(page, 'customerId', '1002'); // a string stays a string, even when it looks numeric
    await editField(page, 'note', 'ring the bell');
    await page.getByRole('button', { name: 'Delete [1]', exact: true }).click(); // second order item
    await expect(page.getByText('Array[1]')).toBeVisible();

    const { sent, code } = await generateNow(page, api);
    const body = typeof sent.data === 'string' ? JSON.parse(sent.data) : sent.data;
    expect(body).toEqual({
      customerId: '1002',
      items: [{ sku: 'SKU-RED-42', qty: 5 }],
      shipping: { method: 'express', address: { city: 'Bengaluru', pin: '560001' } },
      note: 'ring the bell',
    });
    expect(code).toContain('ring the bell');
    expect(code).not.toContain('SKU-BLU-07');
  });

  test('[ED-10] Expand All / Collapse All and per-node collapse', async ({ page }) => {
    await parseToEditor(page, CHROME_BASH);
    await expect(page.getByText('"Bengaluru"', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Collapse shipping' }).click();
    await expect(page.getByText('"Bengaluru"', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand shipping' }).click();
    await expect(page.getByText('"Bengaluru"', { exact: true })).toBeVisible();

    // Everything starts expanded, so the toggle starts as "Collapse All".
    await page.getByRole('button', { name: 'Collapse all body nodes' }).click();
    await expect(page.getByText('"SKU-RED-42"', { exact: true })).toHaveCount(0);
    await expect(page.getByText('"C-1001"', { exact: true })).toBeVisible(); // top-level leaves stay
    await page.getByRole('button', { name: 'Expand all body nodes' }).click();
    await expect(page.getByText('"SKU-RED-42"', { exact: true })).toBeVisible();
  });

  test('[ED-10] with every node expanded the toggle offers Collapse All (BUG-E2E-04)', async ({ page }) => {
    await parseToEditor(page, CHROME_BASH);
    await expect(page.getByText('"SKU-RED-42"', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse all body nodes' })).toBeVisible({ timeout: 2_000 });
  });

  test('[ED-11] dotted keys are edited and deleted as one key, in query and body', async ({ page, api }) => {
    await parseToEditor(page, DOTTED_KEYS);
    await openSection(page, /^Query Parameters/);
    await editField(page, 'filter.name', 'ravi');
    await editField(page, 'user.name', 'Ravi');
    await page.getByRole('button', { name: 'Delete a.b', exact: true }).click();
    await page.getByRole('button', { name: 'Delete [1]', exact: true }).click(); // tags[1] = "y"

    const { sent, code } = await generateNow(page, api);
    expect(sent.query_params).toEqual({ 'filter.name': 'ravi', sort: 'desc' });
    const body = typeof sent.data === 'string' ? JSON.parse(sent.data) : sent.data;
    expect(body).toEqual({ 'user.name': 'Ravi', meta: {}, tags: ['x', 'z'] });
    expect(code).toContain('queryParam("filter.name", "ravi")');
  });

  test('[ED-12] a raw (XML) body is edited as text', async ({ page, api }) => {
    await parseToEditor(page, XML_PUT);
    await page.getByRole('button', { name: 'Edit body' }).click();
    await page.locator('textarea').last().fill('<user><name>John Roe</name></user>');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('<user><name>John Roe</name></user>', { exact: true })).toBeVisible();
    const { sent, code } = await generateNow(page, api);
    expect(sent.data).toBe('<user><name>John Roe</name></user>');
    expect(code).toContain('John Roe');
  });

  test('[ED-13] multi-select: Delete (n) removes every ticked field, Clear (n) unticks', async ({ page, api }) => {
    await parseToEditor(page, CHROME_BASH);
    await page.getByRole('checkbox', { name: 'Select accept for deletion' }).click();
    await page.getByRole('checkbox', { name: 'Select origin for deletion' }).click();
    await expect(page.getByRole('button', { name: 'Delete (2)' })).toBeEnabled();
    await page.getByRole('button', { name: 'Clear (2)' }).click();
    await expect(page.getByRole('button', { name: 'Delete (0)' })).toBeDisabled();

    await page.getByRole('checkbox', { name: 'Select accept for deletion' }).click();
    await page.getByRole('checkbox', { name: 'Select origin for deletion' }).click();
    await openSection(page, /^Query Parameters/);
    await page.getByRole('checkbox', { name: 'Select expand for deletion' }).click();
    await page.getByRole('button', { name: 'Delete (3)' }).click();
    await expect(page.getByRole('button', { name: 'Delete (0)' })).toBeDisabled();

    const { sent } = await generateNow(page, api);
    expect(Object.keys(sent.headers!)).toEqual(['accept-language', 'authorization', 'content-type', 'user-agent']);
    expect(sent.query_params).toEqual({ page: '2' });
  });

  test('[ED-14][ED-15] undo / redo by button and keyboard; text fields keep their own undo', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    const undo = page.getByRole('button', { name: 'Undo' });
    const redo = page.getByRole('button', { name: 'Redo' });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    await page.getByRole('button', { name: 'Delete email', exact: true }).click();
    await page.getByRole('button', { name: 'Delete age', exact: true }).click();
    await undo.click();
    await expect(page.getByText('31', { exact: true })).toBeVisible();
    await expect(page.getByText('"asha@example.com"', { exact: true })).toHaveCount(0);
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(page.getByText('31', { exact: true })).toHaveCount(0);

    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(page.getByText('"asha@example.com"', { exact: true })).toBeVisible();
    await expect(undo).toBeDisabled();
    await page.keyboard.press('Control+y');
    await expect(page.getByText('"asha@example.com"', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByText('31', { exact: true })).toHaveCount(0);

    // While typing in a value, Ctrl+Z belongs to the text field, not to the editor history.
    await page.getByRole('button', { name: 'Edit name', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Value of name' });
    await input.press('End');
    await input.pressSequentially('X');
    await input.press('Control+z');
    await expect(page.getByText('31', { exact: true })).toHaveCount(0); // history untouched
    await page.getByRole('button', { name: 'Save name', exact: true }).click();

    // Ctrl+G opens Code Generation; the result reflects the redone deletes.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Control+g');
    await expect(page.getByRole('dialog', { name: 'Code Generation Configuration' })).toBeVisible();
    await page.locator('#option-full').check();
    await generate(page);
    await api.settle();
    const body = (api.of('/api/generate-from-parsed')[0]!.body as { parsed_data: Parsed }).parsed_data.data;
    const json = typeof body === 'string' ? JSON.parse(body) : body;
    expect(json).not.toHaveProperty('email');
    expect(json).not.toHaveProperty('age');
  });

  test('[ED-28][CG-23] -k: the SSL flag reaches generation; deleting it removes relaxed HTTPS', async ({ page, api }) => {
    await parseToEditor(page, INSECURE_GET);
    const first = await generateNow(page, api);
    expect(first.code).toMatch(/relaxedHTTPSValidation/);

    await page.getByRole('button', { name: 'Delete Section SSL/TLS Configuration' }).click();
    await page.getByRole('dialog', { name: 'Delete section?' }).getByRole('button', { name: 'Delete' }).click();
    const second = await generateNow(page, api);
    expect(second.sent).not.toHaveProperty('ssl_config');
    expect(second.code).not.toMatch(/relaxedHTTPSValidation/);
  });

  test('[ED-27] -A / -e are shown in Transfer Configuration', async ({ page }) => {
    await parseToEditor(page, 'curl "https://api.example.com/ping" -A "CurlCraft-E2E/1.0" -e "https://referrer.example.com/page"');
    await openSection(page, /^Transfer Configuration/);
    const transfer = page.getByRole('region', { name: /^Transfer Configuration/ });
    await expect(transfer.getByText('CurlCraft-E2E/1.0', { exact: true })).toBeVisible();
    await expect(transfer.getByText('https://referrer.example.com/page', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: /^Request Details/ }).getByText('https://api.example.com/ping', { exact: true })).toBeVisible();
  });

  test('[PG-17] a referer given before the URL is not taken as the request URL (BUG-E2E-06)', async ({ page }) => {
    test.fail(true, 'BUG-E2E-06: with `-e <referer>` before the target URL, the backend parses the referer as the request URL');
    await parseToEditor(page, 'curl -e "https://referrer.example.com/page" "https://api.example.com/ping"');
    await expect(page.getByRole('region', { name: /^Request Details/ }).getByText('https://api.example.com/ping', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test('[CG-24] -A / -e reach the generated Java as User-Agent / Referer headers (BUG-E2E-05)', async ({ page, api }) => {
    test.fail(true, 'BUG-E2E-05: the REST Assured generator ignores transfer_config.user_agent / referer, so -A and -e are dropped');
    await parseToEditor(page, 'curl "https://api.example.com/ping" -A "CurlCraft-E2E/1.0" -e "https://referrer.example.com/page"');
    const { code } = await generateNow(page, api);
    expect(code).toContain('CurlCraft-E2E/1.0');
    expect(code).toContain('https://referrer.example.com/page');
  });

  test('[ED-30] body edits stay local: no /api/body/* calls (the body API mirror is off)', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await editField(page, 'name', 'Meera');
    await page.getByRole('button', { name: 'Delete active', exact: true }).click();
    await api.settle();
    expect(api.calls.filter((c) => c.path.startsWith('/api/body'))).toEqual([]);
  });

  test('[ED-25] /editor without a request shows the empty state', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.getByText('No cURL command parsed yet')).toBeVisible();
    await page.getByRole('button', { name: 'Go to Playground' }).click();
    await expect(page).toHaveURL(/\/playground$/);
  });
});
