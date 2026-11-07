import type { Page } from '@playwright/test';
import { test, expect, parseToEditor, curlInput, openCodegen, generate, SECRETS, SIMPLE_POST } from './support/live';

/** Home, app shell (theme, 404, titles, footer), feedback, mobile layout and accessibility basics. */

test.describe('Home', () => {
  test('[HM-01][HM-03][HM-04][HM-05] hero, sections, docs link; the real health check turns the chip ready', async ({ page, api }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/^cURLCraft Assured/);
    await expect(page.getByRole('heading', { level: 1, name: /cURLCraft/i })).toBeVisible();
    for (const title of ['Smart cURL Parsing', 'Visual Editor', 'Code Generation', 'POJO Generation', 'Maven Dependencies']) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: /How It Works/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Documentation/ })).toHaveAttribute('href', /github\.com\/Nataraaj-Shanmugam/);
    await expect(page.getByTestId('backend-status-nav')).toHaveAttribute('data-status', 'ready');
    await expect(page.getByTestId('backend-status-nav')).toHaveText('Generator ready');
    await api.settle();
    const health = api.of('/api/health').find((c) => c.status === 200)!;
    expect(health.response).toMatchObject({ status: 'healthy', environment: 'development' });

    await page.getByRole('button', { name: /Get Started/i }).click();
    await expect(page).toHaveURL(/\/playground$/);
  });

  test('[HM-02] "Open Playground" CTA', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Open Playground/i }).click();
    await expect(page).toHaveURL(/\/playground$/);
  });
});

test.describe('Shell', () => {
  test('[SH-01] the theme toggle switches dark/light and is remembered across reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/playground');
    const html = page.locator('html');
    await expect(html).toHaveClass(/light/);
    await page.getByRole('banner').getByRole('button', { name: 'Toggle theme' }).first().click();
    await expect(html).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('ui-theme'))).toBe('dark');
    await page.reload();
    await expect(html).toHaveClass(/dark/);
    // Body text is light on dark.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeLessThan(200);
    await page.getByRole('banner').getByRole('button', { name: 'Toggle theme' }).first().click();
    await expect(html).toHaveClass(/light/);
  });

  test('[SH-02][SH-03] unknown paths get a 404 page; each route sets its title', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page).toHaveTitle(/^Page not found/);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: /Go to the Playground/i }).click();
    await expect(page).toHaveURL(/\/playground$/);
    await expect(page).toHaveTitle(/^Playground/);
    await page.goto('/feedback');
    await expect(page).toHaveTitle(/^Feedback/);
    await page.goto('/editor');
    await expect(page).toHaveTitle(/^Editor/);
    await page.goto('/batch-editor');
    await expect(page).toHaveTitle(/^Batch Editor/);
  });

  test('[SH-04] footer links on every page', async ({ page }) => {
    for (const path of ['/', '/playground', '/feedback', '/nope']) {
      await page.goto(path);
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByRole('link', { name: 'Feedback' })).toHaveAttribute('href', '/feedback');
      await expect(footer.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', /github\.com\/Nataraaj-Shanmugam/);
      await expect(footer.getByRole('link', { name: /nataraaj\.dev/ })).toHaveAttribute('href', 'https://nataraaj.dev');
    }
  });

  test('[SH-06] a11y basics: one h1 per page, labelled inputs, focus on the h1 after parsing, dialogs return focus', async ({ page }) => {
    for (const path of ['/', '/playground', '/feedback', '/editor', '/nope']) {
      await page.goto(path);
      await expect(page.locator('h1'), path).toHaveCount(1);
    }
    await page.goto('/playground');
    await expect(page.locator('label[for]', { hasText: 'cURL command' })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]').first()).toBeAttached();

    await curlInput(page).fill(SIMPLE_POST);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit Parsed Request' })).toBeFocused();
    for (const name of [/^Export$/, /^Preview$/, /^Generate Code$/]) {
      const opener = page.getByRole('button', { name });
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    // Every editor control has an accessible name.
    const unnamed = await page.locator('main button, main input, main textarea, main [role="checkbox"]').evaluateAll((els) =>
      els.filter((el) => !(el.getAttribute('aria-label') || el.textContent?.trim() || (el as HTMLInputElement).labels?.length)).length,
    );
    expect(unnamed).toBe(0);
  });
});

test.describe('Mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  test('[SH-05] menu, no horizontal overflow, editor actions in the overflow menu', async ({ page }) => {
    for (const path of ['/', '/playground', '/feedback']) {
      await page.goto(path);
      expect(await noSideScroll(page), path).toBeLessThanOrEqual(0);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Toggle menu' }).click();
    await page.getByRole('banner').getByRole('link', { name: 'Playground' }).click();
    await expect(page).toHaveURL(/\/playground$/);
    await expect(page.getByTestId('backend-status-nav-mobile')).toHaveAttribute('data-status', 'ready');

    await parseToEditor(page, SIMPLE_POST);
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: /^Add Section/ })).toBeHidden();
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Export JSON' }).click();
    await expect(page.getByRole('dialog', { name: 'Export JSON' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: /Add Section/ }).click();
    await expect(page.getByRole('dialog', { name: 'Add Missing Section' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Row actions are reachable without hover.
    await page.getByRole('button', { name: 'Delete age', exact: true }).tap();
    await expect(page.getByText('31', { exact: true })).toHaveCount(0);

    await openCodegen(page);
    await page.locator('#option-full').check();
    await generate(page);
    const dialogBox = (await page.getByRole('dialog').boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(390);
  });
});

test.describe('Feedback', () => {
  // The backend allows 5 feedback posts per client IP per hour; give each test its own client.
  let ip = 0;
  test.beforeEach(async ({ page }, info) => {
    ip += 1;
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.51.100.${(info.workerIndex * 50 + ip) % 250}` });
  });

  const SHEETS_DOWN = /Unable to process your feedback at this time|Failed to submit feedback/;

  test('[FB-01][FB-03] the page posts the production payload; the backend (no Sheets configured) refuses and the form keeps the input', async ({ page, api }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Feedback' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible();
    await page.getByRole('radio', { name: 'Feature request' }).click();
    await page.getByRole('radiogroup', { name: /Rating/ }).getByRole('radio').nth(3).click();
    const details = 'Please add Karate DSL output next to REST Assured.';
    await page.getByLabel(/Details/).fill(details);
    await page.getByLabel(/Email/).fill('qa.lead@example.com');
    await page.getByRole('button', { name: /Submit Feedback/ }).click();

    await expect(page.getByRole('alert').filter({ hasText: SHEETS_DOWN })).toBeVisible();
    await expect(page.getByText('Thank you for your feedback!')).toHaveCount(0);
    await expect(page.getByLabel(/Details/)).toHaveValue(details);
    await api.settle();
    const [post] = api.of('/api/feedback');
    expect(post!.status).toBe(500);
    expect(post!.body).toMatchObject({ email: 'qa.lead@example.com', category: 'feature', details, rating: 4 });
    expect((post!.body as { metadata: Record<string, string> }).metadata).toMatchObject({ pageUrl: expect.stringContaining('/feedback') });
    expect((post!.response as { error: { code: string } }).error.code).toBe('SUBMISSION_FAILED');
  });

  test('[FB-02] category and at least 10 characters are required; nothing is sent until then', async ({ page, api }) => {
    await page.goto('/feedback');
    await page.getByLabel(/Details/).fill('short');
    await page.getByRole('button', { name: /Submit Feedback/ }).click();
    await expect(page.getByText('Please select a feedback category')).toBeVisible();
    await page.getByRole('radio', { name: 'Other' }).click();
    await page.getByRole('button', { name: /Submit Feedback/ }).click();
    await expect(page.getByText('Please provide at least 10 characters of feedback')).toBeVisible();
    await expect(page.getByText('5 / 2000')).toBeVisible();
    await api.settle();
    expect(api.of('/api/feedback')).toHaveLength(0);
  });

  test('[FB-06] an invalid email is rejected by the backend validation', async ({ page, api }) => {
    await page.goto('/feedback');
    await page.getByRole('radio', { name: 'Other' }).click();
    await page.getByLabel(/Details/).fill('The email field accepts anything.');
    await page.getByLabel(/Email/).evaluate((el: HTMLInputElement) => (el.type = 'text')); // bypass the browser's own check
    await page.getByLabel(/Email/).fill('not-an-email');
    await page.getByRole('button', { name: /Submit Feedback/ }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await api.settle();
    expect(api.of('/api/feedback')[0]!.status).toBe(422);
    await expect(page.getByRole('alert').first()).toContainText(/email|valid/i);
  });

  test('[FB-04][PG-13] "Report this cURL" opens a bug report that attaches only the redacted command', async ({ page, api }) => {
    await page.goto('/playground');
    await curlInput(page).fill(`curl -H "Authorization: Bearer ${SECRETS.bearer}" no-url-here`);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await page.getByRole('link', { name: 'Report this cURL' }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole('radio', { name: 'Functionality bug' })).toBeChecked();
    await page.getByRole('checkbox', { name: /Include my cURL command/ }).click();
    await page.getByText('Preview what will be attached').click();
    const preview = page.getByRole('region', { name: 'Attached request preview' });
    await expect(preview).toContainText('no-url-here');
    await expect(preview).not.toContainText(SECRETS.bearer);
    await page.getByLabel(/Details/).fill('Parse fails with No URL found.');
    await page.getByRole('button', { name: /Submit Feedback/ }).click();
    await api.settle();
    await expect.poll(() => api.of('/api/feedback').length).toBe(1);
    const sent = api.of('/api/feedback')[0]!;
    expect((sent.body as { curl_command: string }).curl_command).toContain('no-url-here');
    expect(sent.rawBody).not.toContain(SECRETS.bearer);
    expect(JSON.stringify({ ...(await page.evaluate(() => ({ h: history.state, s: { ...sessionStorage } }))) })).not.toContain(SECRETS.bearer);
  });

  test('[FB-05][CG-20] the Feedback dialog after generating attaches redacted code and cURL; Cancel closes it', async ({ page, api }) => {
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await generate(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Feedback' }).click();
    const fb = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /Submit Feedback/ }) });
    await expect(fb).toBeVisible();
    await fb.getByRole('button', { name: 'Cancel' }).click();
    await expect(fb).toHaveCount(0);
    await expect(page.getByRole('dialog').getByText('Generated Code', { exact: true })).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Feedback' }).click();
    await fb.getByRole('radio', { name: 'UI/UX issue' }).click();
    // BUG-E2E-11: the label says "cURL command" although only the generated code is attached here.
    await fb.getByRole('checkbox', { name: /Include my cURL command/ }).click();
    await fb.getByLabel(/Details/).fill('The generated class name differs from what I typed.');
    await fb.getByRole('button', { name: /Submit Feedback/ }).click();
    await expect.poll(() => api.of('/api/feedback').length).toBe(1);
    await api.settle();
    const sent = api.of('/api/feedback')[0]!;
    const body = sent.body as { category: string; generated_code: string; curl_command?: string };
    expect(body.category).toBe('ui_ux');
    expect(body.generated_code).toContain('public class');
    expect(body.curl_command).toBeUndefined();
    expect(sent.rawBody).not.toContain(SECRETS.bearer);
    await expect(fb.getByRole('alert').filter({ hasText: SHEETS_DOWN })).toBeVisible();
  });

  test('[FB-05] the attach option after generating names what is attached (BUG-E2E-11)', async ({ page }) => {
    test.fail(true, 'BUG-E2E-11: the codegen Feedback dialog labels the opt-in "Include my cURL command" but attaches the generated code only');
    await parseToEditor(page, SIMPLE_POST);
    await openCodegen(page);
    await page.locator('#option-full').check();
    await generate(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Feedback' }).click();
    await expect(page.getByRole('checkbox', { name: /generated code/ })).toBeVisible({ timeout: 3_000 });
  });

  test('[FB-07] the backend rate limit (5 per hour per client) is shown in plain words', async ({ page, api }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': '203.0.113.77' });
    await page.goto('/feedback');
    await page.getByRole('radio', { name: 'Other' }).click();
    await page.getByLabel(/Details/).fill('Rate limit check from the live suite.');
    for (let i = 1; i <= 6; i++) {
      await page.getByRole('button', { name: /Submit Feedback/ }).click();
      await expect.poll(() => api.of('/api/feedback').filter((c) => c.status !== undefined).length).toBe(i);
      await api.settle();
    }
    expect(api.of('/api/feedback').map((c) => c.status)).toEqual([500, 500, 500, 500, 500, 429]);
    await expect(page.getByRole('alert').filter({ hasText: /Maximum 5 submissions per hour|Rate limit|too many/i })).toBeVisible();
  });
});
