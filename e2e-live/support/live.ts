import { test as base, expect, type Download, type Locator, type Page, type Request } from '@playwright/test';
import fs from 'node:fs/promises';

/**
 * Shared fixtures for the live suite. Nothing here mocks the API: `page.route` is never used, so
 * every /api call reaches the real backend through the gateway.
 *
 * - `api` records every request the page sends to the backend (method, path, JSON body) and the
 *   JSON it got back, so tests can assert on real payloads ("no unredacted secret was sent").
 * - Any uncaught page error fails the test.
 */

export const GATEWAY = process.env.E2E_LIVE_GATEWAY!;
export const BACKEND = process.env.E2E_LIVE_BACKEND!;

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
  rawBody: string;
  status?: number;
  response?: unknown;
}

export class ApiLog {
  readonly calls: ApiCall[] = [];
  private pending: Promise<unknown>[] = [];

  attach(page: Page) {
    page.on('request', (req: Request) => {
      if (!req.url().startsWith(GATEWAY)) return;
      if (req.method() === 'OPTIONS') return;
      const rawBody = req.postData() ?? '';
      let body: unknown = undefined;
      try {
        body = rawBody ? JSON.parse(rawBody) : undefined;
      } catch {
        body = rawBody;
      }
      const call: ApiCall = { method: req.method(), path: new URL(req.url()).pathname, body, rawBody };
      this.calls.push(call);
      this.pending.push(
        req
          .response()
          .then(async (res) => {
            if (!res) return;
            call.status = res.status();
            try {
              call.response = await res.json();
            } catch {
              /* not JSON (e.g. the gateway's 503 page) */
            }
          })
          .catch(() => undefined),
      );
    });
  }

  of(path: string): ApiCall[] {
    return this.calls.filter((c) => c.path === path);
  }

  /** Wait until every recorded response has been read. */
  async settle() {
    await Promise.all(this.pending);
  }

  /** Everything the page sent to the backend, as one string. */
  sentText(): string {
    return this.calls.map((c) => c.rawBody).join('\n');
  }
}

export const test = base.extend<{ api: ApiLog }>({
  api: async ({ page }, use) => {
    const log = new ApiLog();
    log.attach(page);
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await use(log);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  },
});

export { expect };

// ── Realistic inputs ───────────────────────────────────────────────────────────────────────────

/** Secrets used across the suite; none of them may leak where they shouldn't. */
export const SECRETS = {
  bearer: 'e2e_fake_bearer_token_9f8e7d6c',
  apiKey: 'ak_e2e_7f3a9b2c1d4e5f60',
  cookie: 'sess_e2e_c00k1e_value_42',
  password: 'Hunter2-E2E-pass!',
};

/** "Copy as cURL (bash)" from Chrome DevTools: line continuations, single quotes, --data-raw, -b cookies. */
export const CHROME_BASH = `curl 'https://api.shop.example.com/v2/orders?expand=items&page=2' \\
  -H 'accept: application/json, text/plain, */*' \\
  -H 'accept-language: en-GB,en;q=0.9' \\
  -H 'authorization: Bearer ${SECRETS.bearer}' \\
  -H 'content-type: application/json' \\
  -b 'session_id=${SECRETS.cookie}; theme=dark' \\
  -H 'origin: https://shop.example.com' \\
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' \\
  --data-raw '{"customerId":"C-1001","items":[{"sku":"SKU-RED-42","qty":2},{"sku":"SKU-BLU-07","qty":1}],"shipping":{"method":"express","address":{"city":"Bengaluru","pin":"560001"}},"note":"leave at door"}'`;

/** "Copy as cURL (cmd)" from Chrome on Windows: ^ continuations and ^" escaping. */
export const CHROME_CMD = `curl ^"https://api.shop.example.com/v2/carts/77?currency=INR^" ^
  -X ^"PUT^" ^
  -H ^"accept: application/json^" ^
  -H ^"x-api-key: ${SECRETS.apiKey}^" ^
  -H ^"content-type: application/json^" ^
  --data-raw ^"^{^\\^"coupon^\\^":^\\^"DIWALI10^\\^",^\\^"qty^\\^":3^}^"`;

/** "Copy as PowerShell" from Chrome: Invoke-WebRequest with a -Headers hashtable. */
export const CHROME_POWERSHELL = `$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36"
Invoke-WebRequest -UseBasicParsing -Uri "https://api.shop.example.com/v2/wishlist" \`
-Method "POST" \`
-WebSession $session \`
-Headers @{
"accept"="application/json"
  "authorization"="Bearer ${SECRETS.bearer}"
} \`
-ContentType "application/json" \`
-Body "{\`"sku\`":\`"SKU-RED-42\`"}"`;

export const SIMPLE_GET = `curl -X GET "https://api.example.com/users/42?fields=name,email" -H "Accept: application/json"`;
export const SIMPLE_POST = `curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -H "Authorization: Bearer ${SECRETS.bearer}" -d '{"name":"Asha","email":"asha@example.com","age":31,"active":true}'`;
export const DOTTED_KEYS = `curl -X POST "https://api.example.com/search?filter.name=asha&sort=desc" -H "Content-Type: application/json" -d '{"user.name":"Asha","meta":{"a.b":1},"tags":["x","y","z"]}'`;
export const XML_PUT = `curl -X PUT "https://api.example.com/users/123" -H "Content-Type: application/xml" -d '<user><name>Jane Doe</name><email>jane@example.com</email></user>'`;
export const INSECURE_GET = `curl -k "https://self-signed.internal.example.com/status" -H "Accept: application/json"`;
export const GARBAGE = `this is not a curl command at all`;

// ── Navigation helpers ─────────────────────────────────────────────────────────────────────────

export const curlInput = (page: Page, n?: number) =>
  page.getByRole('textbox', { name: n === undefined ? 'cURL command' : `cURL command ${n}`, exact: true });

/** Playground → Parse cURL → /editor, through the real parser. */
export async function parseToEditor(page: Page, curl: string) {
  await page.goto('/playground');
  await expect(page.getByTestId('backend-status-playground')).toHaveAttribute('data-status', 'ready');
  await curlInput(page).fill(curl);
  await page.getByRole('button', { name: /^Parse cURL$/ }).click();
  await expect(page).toHaveURL(/\/editor$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Parsed Request' })).toBeVisible();
}

/** Fill several commands and press Parse All. */
export async function parseAll(page: Page, curls: string[]) {
  await page.goto('/playground');
  await expect(page.getByTestId('backend-status-playground')).toHaveAttribute('data-status', 'ready');
  for (let i = 1; i < curls.length; i++) await page.getByRole('button', { name: /Add another cURL/ }).click();
  for (let i = 0; i < curls.length; i++) if (curls[i]) await curlInput(page, i + 1).fill(curls[i]!);
  const filled = curls.filter(Boolean).length;
  await page.getByRole('button', { name: `Parse All (${filled})` }).click();
}

/** Open an editor accordion section and make sure it stays open (the editor opens some on mount). */
export async function openSection(page: Page | Locator, title: string | RegExp) {
  const trigger = page.getByRole('button', { name: title }).and(page.locator('[data-state]')).first();
  await expect(async () => {
    if ((await trigger.getAttribute('data-state')) === 'closed') await trigger.click();
    await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

export async function openCodegen(page: Page) {
  await page.getByRole('button', { name: 'Generate Code', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Code Generation Configuration' })).toBeVisible();
  return page.getByRole('dialog');
}

/** Click Generate in the config step and wait for the real backend's result. */
export async function generate(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Generate Code', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** The text of the code panel currently shown in the result step. */
export async function shownCode(page: Page): Promise<string> {
  return (await page.getByRole('dialog').getByRole('tabpanel').innerText()).replace(/\u00a0/g, ' ');
}

export async function downloadText(download: Download): Promise<string> {
  return fs.readFile((await download.path())!, 'utf8');
}

/** Run `action` and collect every download it triggers until `count` have arrived. */
export async function collectDownloads(page: Page, count: number, action: () => Promise<void>) {
  const downloads: Download[] = [];
  const onDownload = (d: Download) => downloads.push(d);
  page.on('download', onDownload);
  await action();
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(count);
  page.off('download', onDownload);
  const out: Record<string, string> = {};
  for (const d of downloads) out[d.suggestedFilename()] = await downloadText(d);
  return out;
}

/** Fires beforeunload like the browser does and reports whether the page asked to block it. */
export const unloadIsBlocked = (page: Page) =>
  page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

export async function clipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

export async function setGatewayMode(mode: 'awake' | 'asleep') {
  const res = await fetch(`${GATEWAY}/__gateway/mode`, { method: 'POST', body: JSON.stringify({ mode }) });
  expect(((await res.json()) as { mode: string }).mode).toBe(mode);
}
