import { test, expect } from './fixtures';
import type { Page, Route, Locator } from '@playwright/test';

/**
 * Batch editor, driven through the real UI: every test starts on the Playground, fills in cURL
 * commands and presses Parse All. Nothing is injected into route state.
 *
 * The backend is mocked at the network layer. `mockBatchApi` replaces the shared fixture's parse
 * and generate handlers (the last-registered route wins) with ones that respond per command, so
 * each request in a batch is distinguishable and one of them can fail.
 */

const CURL_USERS = 'curl -X GET "https://api.example.com/users" -H "Accept: application/json"';
const CURL_ORDERS = 'curl -X POST "https://api.example.com/orders" -H "Content-Type: application/json"';
const CURL_ITEMS = 'curl -X DELETE "https://api.example.com/items/7"';
const CURL_SELF_SIGNED = 'curl -k -X GET "https://self-signed.example.com/status"';
const CURL_BAD = 'invalid-curl-garbage';

function parsedFromCurl(curl: string) {
  const url = /https?:\/\/[^\s'"\\]+/.exec(curl)?.[0] ?? 'https://api.example.com/';
  const { origin, pathname } = new URL(url);
  const method = /-X\s+(\w+)/.exec(curl)?.[1]?.toUpperCase() ?? 'GET';
  const insecure = /(^|\s)(-k|--insecure)(\s|$)/.test(curl);
  return {
    method,
    url,
    base_url: origin,
    endpoint: pathname,
    headers: { Accept: 'application/json' },
    ...(insecure ? { ssl_config: { insecure: true } } : {}),
  };
}

async function mockBatchApi(page: Page) {
  await page.route(/\/api\/parse$/, async (route: Route) => {
    const { curl = '' } = JSON.parse(route.request().postData() ?? '{}');
    if (curl.includes(CURL_BAD)) {
      return route.fulfill({
        status: 422,
        json: { success: false, error: { code: 'PARSE_ERROR', message: 'Invalid cURL command format' } },
      });
    }
    return route.fulfill({ json: { success: true, data: parsedFromCurl(curl) } });
  });

  await page.route(/\/api\/generate-from-parsed/, async (route: Route) => {
    const { parsed_data: parsed, config } = JSON.parse(route.request().postData() ?? '{}');
    const generated = `import io.restassured.RestAssured;
import static io.restassured.RestAssured.*;
import org.testng.annotations.*;

public class ${config.className} {
    @Test
    public void ${config.methodName}() {
        given()
            .header("Accept", "application/json")
        .when()
            .${String(parsed.method).toLowerCase()}("${parsed.url}")
        .then()
            .statusCode(200);
    }
}`;
    return route.fulfill({ json: { success: true, generated_code: generated, language: 'java' } });
  });
}

/** Fill one textarea per command (adding boxes as needed) and press the parse button. */
async function enterCurls(page: Page, curls: string[]) {
  await page.goto('/playground');
  for (let i = 1; i < curls.length; i++) {
    await page.getByText('Add another cURL').click();
  }
  const boxes = page.locator('textarea');
  await expect(boxes).toHaveCount(curls.length);
  for (let i = 0; i < curls.length; i++) {
    if (curls[i]) await boxes.nth(i).fill(curls[i]!);
  }
}

async function parseAll(page: Page, curls: string[]) {
  await enterCurls(page, curls);
  const filled = curls.filter(Boolean).length;
  await page.getByRole('button', { name: new RegExp(`Parse All \\(${filled}\\)`) }).click();
}

const sidebar = (page: Page) => page.getByRole('list', { name: 'Requests' });
const sidebarRow = (page: Page, name: string) =>
  sidebar(page).getByRole('button', { name, exact: true });

/** The remove button only appears on hover, like a user would find it. */
async function removeRequest(page: Page, name: string) {
  await sidebarRow(page, name).hover();
  await page.getByRole('button', { name: `Remove ${name}` }).click();
}

/** Edit the endpoint of the request currently shown in the editor. */
async function editEndpoint(page: Page, value: string, { commit = true } = {}) {
  await page.getByRole('button', { name: 'Edit endpoint' }).click();
  await page.getByRole('textbox').fill(value);
  if (commit) await page.getByRole('button', { name: 'Save endpoint' }).click();
}

const shownCurl = (page: Page, text: string): Locator => page.getByText(text, { exact: false }).first();

test.describe('Batch Editor Page', () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({ mockPage: page }) => {
    await mockBatchApi(page);
  });

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

  // ── Parse All → batch editor ──────────────────────────────────────────────

  test('Parse All opens the batch editor with every parsed request', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS, CURL_ITEMS]);

    await expect(page).toHaveURL(/\/batch-editor/);
    await expect(page.getByRole('heading', { name: /No Requests/i })).toHaveCount(0);
    await expect(page.getByText('Batch Editor', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate All/i })).toBeVisible();

    await expect(sidebarRow(page, 'GET /users')).toBeVisible();
    await expect(sidebarRow(page, 'POST /orders')).toBeVisible();
    await expect(sidebarRow(page, 'DELETE /items/7')).toBeVisible();
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(3);
    // The count badge.
    await expect(page.getByText('3', { exact: true })).toBeVisible();
    // No errors when everything parsed.
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a command that fails to parse is reported and the others are kept', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_BAD, CURL_ORDERS]);

    await expect(page).toHaveURL(/\/batch-editor/);
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
    await expect(sidebarRow(page, 'GET /users')).toBeVisible();
    await expect(sidebarRow(page, 'POST /orders')).toBeVisible();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('1 command could not be parsed');
    await expect(alert).toContainText('Command 2: Invalid cURL command format');
    await expect(alert).toContainText(CURL_BAD);

    await page.getByRole('button', { name: 'Dismiss parse errors' }).click();
    await expect(alert).toHaveCount(0);
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
  });

  test('when no command parses, the playground stays and flags each one', async ({ mockPage: page }) => {
    await parseAll(page, [`${CURL_BAD} one`, `${CURL_BAD} two`]);

    await expect(page).toHaveURL(/\/playground/);
    await expect(page.getByText('None of the 2 cURL commands could be parsed.', { exact: true })).toBeVisible();
    await expect(page.getByText(/curl-input-1: Invalid cURL command format/)).toBeVisible();
    await expect(page.getByText(/curl-input-2: Invalid cURL command format/)).toBeVisible();
  });

  test('one filled command plus a blank one opens the single editor', async ({ mockPage: page }) => {
    await enterCurls(page, [CURL_USERS, '']);

    // Only one command is filled in: this is a plain parse, not a batch.
    await expect(page.getByRole('button', { name: /Parse All/i })).toHaveCount(0);
    await page.getByRole('button', { name: /Parse cURL/i }).click();

    await expect(page).toHaveURL(/\/editor/);
    await expect(page).not.toHaveURL(/batch-editor/);
  });

  test('blank commands between filled ones are ignored', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, '', CURL_ORDERS]);

    await expect(page).toHaveURL(/\/batch-editor/);
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('importing several requests parses them into the batch editor', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Import/i }).click();

    const collection = {
      info: { _postman_id: 'e2e', name: 'E2E' },
      item: [
        { name: 'List users', request: { method: 'GET', url: 'https://api.example.com/users' } },
        { name: 'Create order', request: { method: 'POST', url: 'https://api.example.com/orders' } },
      ],
    };
    await page.getByRole('dialog').getByRole('textbox').fill(JSON.stringify(collection));
    await page.getByRole('button', { name: /Import Selected \(2\)/ }).click();

    await expect(page).toHaveURL(/\/batch-editor/);
    await expect(sidebarRow(page, 'GET /users')).toBeVisible();
    await expect(sidebarRow(page, 'POST /orders')).toBeVisible();
  });

  // ── Working in the editor ─────────────────────────────────────────────────

  test('the first request is selected and clicking another loads it in the editor', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);

    await expect(sidebarRow(page, 'GET /users')).toHaveAttribute('aria-current', 'true');
    await expect(shownCurl(page, 'curl -X GET "https://api.example.com/users"')).toBeVisible();

    await sidebarRow(page, 'POST /orders').click();

    await expect(sidebarRow(page, 'POST /orders')).toHaveAttribute('aria-current', 'true');
    await expect(shownCurl(page, 'curl -X POST "https://api.example.com/orders"')).toBeVisible();
    await expect(page.getByText('curl -X GET "https://api.example.com/users"')).toBeHidden();
  });

  test('edits are kept when switching to another request and back', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);

    await editEndpoint(page, '/users/v2');
    await expect(sidebarRow(page, 'GET /users/v2')).toBeVisible();

    await sidebarRow(page, 'POST /orders').click();
    await sidebarRow(page, 'GET /users/v2').click();

    await expect(page.getByTestId('batch-editor-panel').getByText('/users/v2', { exact: true })).toBeVisible();
    // The other request was not touched.
    await expect(sidebarRow(page, 'POST /orders')).toBeVisible();
  });

  test('a half-typed edit survives switching away and back', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);

    await editEndpoint(page, '/typing-in-progress', { commit: false });
    await sidebarRow(page, 'POST /orders').click();
    await sidebarRow(page, 'GET /users').click();

    await expect(page.getByRole('textbox')).toHaveValue('/typing-in-progress');
  });

  test('removing a request never makes a later edit overwrite a different one', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS, CURL_ITEMS]);

    await sidebarRow(page, 'POST /orders').click();
    await removeRequest(page, 'GET /users');

    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
    await expect(sidebarRow(page, 'POST /orders')).toHaveAttribute('aria-current', 'true');

    await editEndpoint(page, '/orders/saved');
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0);

    await expect(sidebarRow(page, 'POST /orders/saved')).toBeVisible();
    await expect(sidebarRow(page, 'DELETE /items/7')).toBeVisible();
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
  });

  test('removing the selected request selects its neighbour; removing the last shows the empty state', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);

    await removeRequest(page, 'GET /users');
    await expect(sidebarRow(page, 'POST /orders')).toHaveAttribute('aria-current', 'true');
    await expect(shownCurl(page, 'curl -X POST "https://api.example.com/orders"')).toBeVisible();

    await removeRequest(page, 'POST /orders');
    await expect(page.getByRole('heading', { name: /No Requests/i })).toBeVisible();
  });

  test('Back to Playground navigates away', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);

    await page.getByRole('button', { name: /Back to Playground/i }).click();
    await expect(page).toHaveURL(/\/playground/);
  });

  // ── Generate All ──────────────────────────────────────────────────────────

  test('Generate All gives duplicate requests unique method names', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_USERS, CURL_ORDERS]);

    await page.getByRole('button', { name: /Generate All/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('textbox').nth(1)).toHaveValue('testGet_users');
    await expect(dialog.getByRole('textbox').nth(2)).toHaveValue('testGet_users_2');
    await dialog.getByRole('button', { name: 'Generate All' }).click();

    const code = dialog.locator('pre');
    await expect(code).toContainText('public class BatchApiTest');
    await expect(code).toContainText('public void testGet_users()');
    await expect(code).toContainText('public void testGet_users_2()');
    await expect(code).toContainText('public void testPost_orders()');
  });

  test('Generate All relaxes HTTPS validation only for the request that used -k', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_SELF_SIGNED]);

    await page.getByRole('button', { name: /Generate All/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Generate All' }).click();

    const code = dialog.locator('pre');
    await expect(code).toContainText('public void testGet_status()');
    const text = (await code.textContent()) ?? '';
    const [usersMethod, statusMethod] = [
      text.slice(text.indexOf('public void testGet_users()'), text.indexOf('public void testGet_status()')),
      text.slice(text.indexOf('public void testGet_status()')),
    ];
    expect(usersMethod).not.toContain('relaxedHTTPSValidation');
    expect(statusMethod).toContain('given().relaxedHTTPSValidation()');
    expect(text).not.toContain('useRelaxedHTTPSValidation');
  });
  // ── Unsaved edits, undo, retry ────────────────────────────────────────────

  test('leaving with an edit asks first; Keep editing stays, Discard leaves', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);
    await editEndpoint(page, '/users/v2');

    await page.getByRole('button', { name: /Back to Playground/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Discard unsaved edits?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/batch-editor/);
    await expect(sidebarRow(page, 'GET /users/v2')).toBeVisible();

    await page.getByRole('button', { name: /Back to Playground/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard and leave' }).click();
    await expect(page).toHaveURL(/\/playground/);
  });

  test('removing a request can be undone from the toast', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS, CURL_ITEMS]);

    await removeRequest(page, 'POST /orders');
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' }).click();

    await expect(sidebar(page).getByRole('listitem')).toHaveCount(3);
    await expect(sidebar(page).getByRole('listitem').nth(1)).toContainText('POST');
    await expect(sidebarRow(page, 'POST /orders')).toHaveAttribute('aria-current', 'true');
  });

  test('a command that failed to parse can be fixed and retried in place', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_BAD]);
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(1);

    await page.getByRole('textbox', { name: 'cURL for command 2' }).fill(CURL_ORDERS);
    await page.getByRole('button', { name: 'Retry command 2' }).click();

    await expect(sidebarRow(page, 'POST /orders')).toBeVisible();
    await expect(sidebar(page).getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  // ── Small screens ─────────────────────────────────────────────────────────

  test.describe('at 390px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the request list collapses to a selector and the editor keeps the full width', async ({ mockPage: page }) => {
      await parseAll(page, [CURL_USERS, CURL_ORDERS, CURL_ITEMS]);

      await expect(sidebar(page)).toBeHidden();
      const select = page.getByRole('combobox', { name: 'Request' });
      await expect(select).toBeVisible();

      // Nothing overflows sideways and the editor is not squeezed into a sliver.
      const { overflow, editorWidth } = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        editorWidth: (document.querySelector('[data-testid="batch-editor-panel"]') as HTMLElement).getBoundingClientRect().width,
      }));
      expect(overflow).toBeLessThanOrEqual(0);
      expect(editorWidth).toBeGreaterThan(330);

      await select.selectOption({ label: 'POST /orders' });
      await expect(shownCurl(page, 'curl -X POST "https://api.example.com/orders"')).toBeVisible();

      await page.getByRole('button', { name: 'Remove selected request' }).click();
      await expect(select.locator('option')).toHaveCount(2);
    });
  });

  // ── Generate All validation, failures, status, redaction ─────────────────

  test('Generate All refuses invalid or duplicate names and a status outside 100-599', async ({ mockPage: page }) => {
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);
    await page.getByRole('button', { name: /Generate All/i }).click();
    const dialog = page.getByRole('dialog');
    const generate = dialog.getByRole('button', { name: 'Generate All' });

    await dialog.getByLabel('Test Class Name').fill('My Test Class');
    await expect(generate).toBeDisabled();
    await dialog.getByLabel('Test Class Name').fill('MyTests');
    await dialog.getByRole('textbox', { name: 'Method name for GET /users' }).fill('same name');
    await expect(generate).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Method name for GET /users' }).fill('dup');
    await dialog.getByRole('textbox', { name: 'Method name for POST /orders' }).fill('dup');
    await expect(dialog).toContainText('Already used by another request');
    await expect(generate).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Method name for POST /orders' }).fill('create');
    await dialog.getByRole('spinbutton', { name: 'Expected status for GET /users' }).fill('999');
    await expect(generate).toBeDisabled();
    await dialog.getByRole('spinbutton', { name: 'Expected status for GET /users' }).fill('200');
    await expect(generate).toBeEnabled();
  });

  test('Generate All sends 201 for POST by default and reports failed requests', async ({ mockPage: page }) => {
    const sent: { method: string; status: string }[] = [];
    await page.route(/\/api\/generate-from-parsed/, async (route) => {
      const { parsed_data: parsed, config } = JSON.parse(route.request().postData() ?? '{}');
      sent.push({ method: parsed.method, status: config.statusCode });
      if (parsed.method === 'GET') return route.fulfill({ json: { success: false, error: 'boom' } });
      return route.fulfill({
        json: { success: true, generated_code: `@Test\npublic void ${config.methodName}() {}` },
      });
    });
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);
    await page.getByRole('button', { name: /Generate All/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('spinbutton', { name: 'Expected status for POST /orders' })).toHaveValue('201');

    await dialog.getByRole('button', { name: 'Generate All' }).click();

    await expect(dialog.getByRole('alert')).toContainText('1 of 2 requests');
    await expect(dialog.getByRole('alert')).toContainText('GET /users: boom');
    expect(sent).toEqual([
      { method: 'GET', status: '200' },
      { method: 'POST', status: '201' },
    ]);
  });

  test('Generate All shows an error, not a result, when every request fails', async ({ mockPage: page }) => {
    await page.route(/\/api\/generate-from-parsed/, (route) => route.fulfill({ status: 500, json: { success: false } }));
    await parseAll(page, [CURL_USERS, CURL_ORDERS]);
    await page.getByRole('button', { name: /Generate All/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: 'Generate All' }).click();

    await expect(dialog.getByRole('alert')).toContainText('Code generation failed for all 2 requests');
    await expect(dialog.getByText('Generated Batch Code')).toHaveCount(0);
  });

  test('copying the batch code redacts secrets unless the user opts out', async ({ mockPage: page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route(/\/api\/generate-from-parsed/, async (route) => {
      const { config } = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({
        json: {
          success: true,
          generated_code: `@Test\npublic void ${config.methodName}() { given().header("Authorization", "Bearer abc123tokenvalue"); }`,
        },
      });
    });
    await parseAll(page, [`${CURL_USERS} -H "Authorization: Bearer abc123tokenvalue"`, CURL_ORDERS]);
    await page.getByRole('button', { name: /Generate All/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Generate All' }).click();
    const redact = dialog.getByRole('checkbox', { name: 'Redact secrets when copying' });
    await expect(redact).toBeChecked();

    await dialog.getByRole('button', { name: /Copy/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).not.toContain('abc123tokenvalue');

    await redact.click();
    await dialog.getByRole('button', { name: /Copy/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('abc123tokenvalue');
  });

  // ── Secrets in history.state ─────────────────────────────────────────────

  test('history.state keeps only a redacted batch; a reload blocks Generate All until secrets are re-entered', async ({ mockPage: page }) => {
    const TOKEN = 'sk_live_BATCH_PLAYWRIGHT_77aa88bb';
    const KEY = 'batch-api-key-SECRET-5566';
    await page.route(/\/api\/parse$/, async (route: Route) => {
      const { curl = '' } = JSON.parse(route.request().postData() ?? '{}');
      const data = parsedFromCurl(curl);
      const headers = curl.includes(TOKEN) ? { Authorization: `Bearer ${TOKEN}` } : { 'X-Api-Key': KEY };
      return route.fulfill({ json: { success: true, data: { ...data, headers } } });
    });
    await parseAll(page, [
      `${CURL_USERS} -H "Authorization: Bearer ${TOKEN}"`,
      `${CURL_ORDERS} -H "X-Api-Key: ${KEY}"`,
    ]);
    await expect(page).toHaveURL(/\/batch-editor/);
    await expect.poll(() => page.evaluate(() => JSON.stringify(window.history.state))).toContain('[REDACTED]');
    const history = await page.evaluate(() => JSON.stringify(window.history.state));
    expect(history).not.toContain(TOKEN);
    expect(history).not.toContain(KEY);
    // This visit still has the live values.
    await expect(page.getByRole('button', { name: 'Generate All' })).toBeEnabled();

    await page.reload();
    await expect(page.getByText('Batch Editor', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate All' })).toBeDisabled();
    await expect(page.getByText('Re-enter 2 redacted values to generate code.', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(TOKEN);
  });
});
