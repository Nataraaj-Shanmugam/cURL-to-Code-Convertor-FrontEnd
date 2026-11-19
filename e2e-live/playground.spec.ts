import {
  test,
  expect,
  curlInput,
  parseToEditor,
  parseAll,
  openSection,
  clipboard,
  CHROME_BASH,
  CHROME_CMD,
  CHROME_POWERSHELL,
  GARBAGE,
  INSECURE_GET,
  SECRETS,
  SIMPLE_GET,
  SIMPLE_POST,
  XML_PUT,
} from './support/live';

/** The value cell shown for a field row in the editor. */
const fieldRow = (page: import('@playwright/test').Page, label: string) =>
  page.locator('div.group').filter({ has: page.getByText(label, { exact: true }) }).first();

test.describe('Playground: single cURL against the real parser', () => {
  test('[PG-01][PG-12] a pasted cURL is parsed by the backend and opens in the editor', async ({ page, api }) => {
    await page.goto('/playground');
    await expect(page.getByTestId('curl-data-notice')).toContainText('sent to the cURLCraft backend');
    await curlInput(page).fill(SIMPLE_POST);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page).toHaveURL(/\/editor$/);

    await api.settle();
    const [parse] = api.of('/api/parse');
    expect(parse!.status).toBe(200);
    expect(parse!.body).toEqual({ curl: SIMPLE_POST });

    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('POST')).toBeVisible();
    await expect(fieldRow(page, 'endpoint')).toContainText('/users');
    await expect(fieldRow(page, 'base_url')).toContainText('https://api.example.com');
    await expect(fieldRow(page, 'Content-Type')).toContainText('application/json');
    // The real backend returns the -d body as a JSON string; the editor shows it as a tree.
    await expect(page.getByText('"asha@example.com"', { exact: true })).toBeVisible();
    await expect(page.getByText('31', { exact: true })).toBeVisible();
  });

  test('[PG-02] Chrome "Copy as cURL (bash)": headers, cookies, query and nested body all arrive', async ({ page }) => {
    await parseToEditor(page, CHROME_BASH);

    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('POST')).toBeVisible();
    await expect(fieldRow(page, 'endpoint')).toContainText('/v2/orders');
    for (const header of ['accept', 'accept-language', 'authorization', 'content-type', 'origin', 'user-agent']) {
      await expect(page.getByText(header, { exact: true }).first()).toBeVisible();
    }
    await openSection(page, /^Query Parameters/);
    await expect(fieldRow(page, 'expand')).toContainText('items');
    await openSection(page, /^Cookies/);
    await expect(page.getByText('session_id', { exact: true })).toBeVisible();
    await expect(page.getByText('theme', { exact: true })).toBeVisible();
    // Nested body: arrays of objects and objects in objects.
    await expect(page.getByText('Array[2]')).toBeVisible();
    await expect(page.getByText('"SKU-BLU-07"', { exact: true })).toBeVisible();
    await expect(page.getByText('"Bengaluru"', { exact: true })).toBeVisible();
    // The bearer token and cookie are masked, never shown.
    await expect(page.locator('body')).not.toContainText(SECRETS.bearer);
    await expect(page.locator('body')).not.toContainText(SECRETS.cookie);
  });

  test('[PG-04] PowerShell curl.exe with backtick continuations is parsed', async ({ page }) => {
    const ps = 'curl.exe `\n  -X POST `\n  "https://api.example.com/v1/tickets" `\n  -H "Content-Type: application/json" `\n  -H "X-Team: qa" `\n  -d "title=Broken+login"';
    await parseToEditor(page, ps);
    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('POST')).toBeVisible();
    await expect(fieldRow(page, 'endpoint')).toContainText('/v1/tickets');
    await expect(fieldRow(page, 'X-Team')).toContainText('qa');
    await expect(page.getByText('title=Broken+login').first()).toBeVisible();
  });

  test('[PG-03] Chrome "Copy as cURL (cmd)" parses (BUG-E2E-01: backend BUG-P7, ^ escaping unsupported)', async ({ page, api }) => {
    await page.goto('/playground');
    await curlInput(page).fill(CHROME_CMD);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await api.settle();
    await expect(page).toHaveURL(/\/editor$/, { timeout: 5_000 });
    await expect(fieldRow(page, 'x-api-key')).toBeVisible();
  });

  test('[PG-05] Chrome "Copy as PowerShell" is either parsed faithfully or refused (BUG-E2E-02)', async ({ page }) => {
    await page.goto('/playground');
    await curlInput(page).fill(CHROME_POWERSHELL);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    // Correct outcomes: an error on the Playground, or an editor showing the POST with its auth header.
    const refused = page.getByRole('alert').filter({ hasText: /not|invalid|unsupported/i });
    const faithful = page.getByRole('button', { name: /^Request Details/ }).getByText('POST');
    await expect(refused.or(faithful)).toBeVisible({ timeout: 10_000 });
  });

  test('[PG-16] an XML body is kept as raw text', async ({ page }) => {
    await parseToEditor(page, XML_PUT);
    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('PUT')).toBeVisible();
    await expect(page.getByText('<user><name>Jane Doe</name><email>jane@example.com</email></user>', { exact: true })).toBeVisible();
  });

  test('[PG-15] -k is parsed into an SSL/TLS section', async ({ page }) => {
    await parseToEditor(page, INSECURE_GET);
    await expect(page.getByRole('button', { name: /^SSL\/TLS Configuration/ })).toBeVisible();
  });

  test('[PG-06][PG-07] a backend parse error is shown in plain words; editing clears it and a fixed cURL parses', async ({ page, api }) => {
    await page.goto('/playground');
    await curlInput(page).fill(GARBAGE);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page.getByText('No URL found in cURL command')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report this cURL' })).toBeVisible();
    await expect(page).toHaveURL(/\/playground$/);
    await api.settle();
    expect(api.of('/api/parse')[0]!.status).toBe(400);
    // Not retryable: a validation error is not offered a Retry.
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);

    await curlInput(page).fill(SIMPLE_GET);
    await expect(page.getByText('No URL found in cURL command')).toHaveCount(0);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page).toHaveURL(/\/editor$/);
  });

  test('[PG-06] a URL the backend rejects is reported with its message', async ({ page }) => {
    await page.goto('/playground');
    await curlInput(page).fill('curl -X POST "ht!tp://bad host/x" -d "a=1"');
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /URL|valid/i }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/playground$/);
  });

  test('[PG-08] Parse and Reset are disabled while empty; Reset clears the input and the error', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByRole('button', { name: 'Parse cURL' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeDisabled();
    await curlInput(page).fill('   ');
    await expect(page.getByRole('button', { name: 'Parse cURL' })).toBeDisabled();

    await curlInput(page).fill(GARBAGE);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page.getByText('No URL found in cURL command')).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(curlInput(page)).toHaveValue('');
    await expect(page.getByText('No URL found in cURL command')).toHaveCount(0);
    await expect(page.getByText('Try an example:')).toBeVisible();
  });

  test('[PG-10] Ctrl+Enter parses', async ({ page }) => {
    await page.goto('/playground');
    await curlInput(page).fill(SIMPLE_GET);
    await page.keyboard.press('Control+Enter');
    await expect(page).toHaveURL(/\/editor$/);
    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('GET')).toBeVisible();
  });

  test('[PG-11] line count and Copy put the command on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/playground');
    await curlInput(page).fill(CHROME_BASH);
    await expect(page.getByTestId('line-count')).toHaveText('9 lines');
    await page.getByRole('button', { name: 'Copy cURL command' }).click();
    await expect(page.getByText('cURL command copied to clipboard')).toBeVisible();
    expect(await clipboard(page)).toBe(CHROME_BASH);
  });
});

test.describe('Playground: examples', () => {
  const EXAMPLES: [string, string, RegExp][] = [
    ['GET Request', 'GET', /\/posts\/1/],
    ['POST with JSON Body', 'POST', /\/posts$/],
    ['With Auth Header', 'GET', /\/users$/],
    ['PUT Update Resource', 'PUT', /\/posts\/1/],
    ['DELETE Request', 'DELETE', /\/posts\/1/],
    ['PATCH Partial Update', 'PATCH', /\/posts\/1/],
    ['PUT with XML Body', 'PUT', /\/users\/123/],
    ['Nested JSON Body', 'POST', /\/create-user/],
    ['Form Data Upload', 'POST', /\/upload/],
    ['Query Parameters', 'GET', /\/search/],
  ];

  test('[PG-09] every example fills the input and is accepted by the real parser', async ({ page }) => {
    test.setTimeout(120_000);
    for (const [label, method, endpoint] of EXAMPLES) {
      await page.goto('/playground');
      await expect(page.getByText('Try an example:')).toBeVisible();
      await page.getByRole('button', { name: new RegExp(label) }).click();
      await expect(curlInput(page)).toHaveValue(/^curl /);
      await expect(page.getByText('Try an example:')).toHaveCount(0);
      await page.getByRole('button', { name: 'Parse cURL' }).click();
      await expect(page, label).toHaveURL(/\/editor$/);
      await expect(page.getByRole('button', { name: /^Request Details/ }).getByText(method, { exact: true })).toBeVisible();
      await expect(fieldRow(page, 'endpoint')).toContainText(endpoint);
    }
  });

  test('[PG-14] the Form Data example is parsed into a Form Data section with the file part', async ({ page }) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Form Data Upload/ }).click();
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page).toHaveURL(/\/editor$/);
    await openSection(page, /^Form Data/);
    await expect(page.getByText('category', { exact: true })).toBeVisible();
    await expect(page.getByText('documents').first()).toBeVisible();
    await expect(page.getByText('file', { exact: true })).toBeVisible();
  });
});

test.describe('Playground: several commands', () => {
  test('[PM-01][PM-06] adding commands switches to multi mode; removing goes back', async ({ page }) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Add another cURL/ }).click();
    await expect(page.getByText('2 commands')).toBeVisible();
    await expect(curlInput(page, 1)).toBeVisible();
    await expect(curlInput(page, 2)).toBeVisible();
    await curlInput(page, 1).fill(SIMPLE_GET);
    await expect(page.getByRole('button', { name: 'Parse cURL' })).toBeVisible(); // one filled: single parse
    await curlInput(page, 2).fill(SIMPLE_POST);
    await expect(page.getByRole('button', { name: 'Parse All (2)' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove cURL command 2' }).click();
    await expect(page.getByText(/\d commands/)).toHaveCount(0);
    await expect(curlInput(page)).toHaveValue(SIMPLE_GET);
  });

  test('[PM-07] in multi mode an example fills the empty command', async ({ page }) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Add another cURL/ }).click();
    await curlInput(page, 1).fill(SIMPLE_GET);
    await page.getByRole('button', { name: /DELETE Request/ }).click();
    await expect(curlInput(page, 1)).toHaveValue(SIMPLE_GET);
    await expect(curlInput(page, 2)).toHaveValue(/-X DELETE/);
  });

  test('[PM-02] Parse All sends one parse per command and opens the batch editor', async ({ page, api }) => {
    await parseAll(page, [SIMPLE_GET, SIMPLE_POST, XML_PUT]);
    await expect(page).toHaveURL(/\/batch-editor$/);
    await api.settle();
    expect(api.of('/api/parse').map((c) => (c.body as { curl: string }).curl).sort()).toEqual(
      [SIMPLE_GET, SIMPLE_POST, XML_PUT].sort(),
    );
    const list = page.getByRole('list', { name: 'Requests' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByRole('button', { name: 'GET /users/42', exact: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'POST /users', exact: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'PUT /users/123', exact: true })).toBeVisible();
  });

  test('[PM-04] when no command parses the Playground stays and flags each one', async ({ page }) => {
    await parseAll(page, [GARBAGE, 'curl']);
    await expect(page).toHaveURL(/\/playground$/);
    await expect(page.getByText('None of the 2 cURL commands could be parsed.')).toBeVisible();
    await expect(page.getByText(/cURL command 1: No URL found in cURL command/)).toBeVisible();
    await expect(page.getByText(/cURL command 2: /)).toBeVisible();
    await expect(curlInput(page, 1)).toHaveAttribute('aria-invalid', 'true');
    // Fixing one clears just its error.
    await curlInput(page, 1).fill(SIMPLE_GET);
    await expect(page.getByText(/cURL command 1: /)).toHaveCount(0);
  });

  test('[PM-05] blank commands are ignored: one filled + one blank is a single parse', async ({ page }) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Add another cURL/ }).click();
    await page.getByRole('button', { name: /Add another cURL/ }).click();
    await curlInput(page, 2).fill(SIMPLE_GET);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page).toHaveURL(/\/editor$/);
  });
});

test.describe('Known backend parser bugs, seen through the UI (ids from the backend unit suite)', () => {

  test('[PG-18] -X GET with -d stays a GET (backend BUG-P1)', async ({ page }) => {
    await parseToEditor(page, `curl -X GET "https://api.example.com/search" -d 'q=shoes'`);
    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('GET', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test('[PG-18] bundled -XPOST is honoured (backend BUG-P6)', async ({ page }) => {
    await parseToEditor(page, `curl -sSL -XPOST "https://api.example.com/jobs"`);
    await expect(page.getByRole('button', { name: /^Request Details/ }).getByText('POST', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test("[PG-18] ANSI-C $'...' quoting is accepted (backend BUG-P8)", async ({ page }) => {
    await parseToEditor(page, `curl 'https://api.example.com/notes' -H 'content-type: application/json' --data-raw $'{"text":"it\\'s ok"}'`);
    await expect(page.getByText(`"it's ok"`, { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test("[PG-18] a '\\'' inside single quotes keeps the rest of the body (backend BUG-P14)", async ({ page }) => {
    await parseToEditor(page, `curl -X POST "https://api.example.com/notes" -H "Content-Type: application/json" -d '{"text":"it'\\''s fine","n":1}'`);
    await expect(page.getByText(`"it's fine"`, { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible({ timeout: 3_000 });
  });
});
