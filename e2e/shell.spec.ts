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

test.describe('Feedback (QR-6)', () => {
  const DETAILS = 'The Export dialog should offer a one-click download.';

  async function captureFeedback(page: Page) {
    const sent: { payload: Record<string, unknown> | null } = { payload: null };
    await page.route(/\/api\/feedback/, async (route) => {
      sent.payload = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({ json: { success: true } });
    });
    return sent;
  }

  test('the nav and footer link to /feedback, which submits production\'s payload', async ({ mockPage: page }) => {
    const sent = await captureFeedback(page);
    await page.goto('/');
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Feedback' })).toBeVisible();
    await page.getByRole('banner').getByRole('link', { name: 'Feedback' }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible();

    await page.getByRole('radio', { name: 'Feature request' }).click();
    await page.getByLabel(/Details/).fill(DETAILS);
    await page.getByLabel(/Email/).fill('qa@example.com');
    await page.getByRole('button', { name: /Submit Feedback/i }).click();
    await expect(page.getByText('Thank you for your feedback!')).toBeVisible();

    expect(sent.payload).toMatchObject({ email: 'qa@example.com', category: 'feature', details: DETAILS });
    expect(sent.payload?.metadata).toEqual({
      userAgent: expect.any(String),
      pageUrl: expect.stringContaining('/feedback'),
      timestamp: expect.any(String),
      screenResolution: expect.stringMatching(/^\d+x\d+$/),
    });
    expect(sent.payload).not.toHaveProperty('rating');
  });

  test('Report this cURL on a parse error opens a bug report that can attach the redacted command', async ({ mockPage: page }) => {
    const sent = await captureFeedback(page);
    await page.goto('/playground');
    await page.getByLabel('cURL command').fill('invalid-curl-garbage -H "Authorization: Bearer abcdef123456"');
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await page.getByRole('link', { name: 'Report this cURL' }).click();

    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole('radio', { name: 'Functionality bug' })).toBeChecked();
    await page.getByRole('checkbox', { name: /Include my cURL command/i }).click();
    await page.getByLabel(/Details/).fill('Parsing fails with the message shown.');
    await page.getByRole('button', { name: /Submit Feedback/i }).click();
    await expect(page.getByText('Thank you for your feedback!')).toBeVisible();

    expect(sent.payload?.category).toBe('bug');
    expect(String(sent.payload?.curl_command)).toContain('invalid-curl-garbage');
    expect(JSON.stringify(sent.payload)).not.toContain('abcdef123456');
  });
});

test.describe('Playground examples and Copy (QR-7)', () => {
  test('the XML, nested JSON, form-data and query-param examples fill the input; Copy confirms with a toast', async ({ mockPage: page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/playground');
    const input = page.getByRole('textbox', { name: 'cURL command' });

    await page.getByRole('button', { name: /PUT with XML Body/ }).click();
    await expect(input).toHaveValue(/application\/xml.*<user><name>Jane Doe<\/name>/);
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: /Nested JSON Body/ }).click();
    await expect(input).toHaveValue(/"city": \{"city": "Chennai"/);
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: /Form Data Upload/ }).click();
    await expect(input).toHaveValue(/-F "file=@document\.pdf"/);
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: /Query Parameters/ }).click();
    await expect(input).toHaveValue(/search\?q=test&page=1&limit=10/);

    await expect(page.getByTestId('line-count')).toHaveText('1 line');
    await page.getByRole('button', { name: 'Copy cURL command' }).click();
    await expect(page.getByText('cURL command copied to clipboard')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('search?q=test');
  });
});

test.describe('Motion (T32)', () => {
  test('with prefers-reduced-motion nothing animates and below-the-fold sections are visible straight away', async ({ mockPage: page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const lastSection = page.getByRole('heading', { name: /Ready to Transform/i }).locator('xpath=ancestor::div[@data-reveal][1]');
    await expect(lastSection).toHaveCSS('opacity', '1');
    await expect(lastSection).toHaveAttribute('data-reveal', 'done');
    const durations = await page.evaluate(() => [
      getComputedStyle(document.querySelector('.animate-page-enter')!).animationDuration,
      getComputedStyle(document.querySelector('.animate-hero-left')!).animationDuration,
    ]);
    for (const d of durations) expect(parseFloat(d)).toBeLessThan(0.001);
  });

  test('without it, below-the-fold sections fade in when scrolled to', async ({ mockPage: page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const lastSection = page.getByRole('heading', { name: /Ready to Transform/i }).locator('xpath=ancestor::div[@data-reveal][1]');
    await expect(lastSection).toHaveAttribute('data-reveal', 'pending');
    await lastSection.scrollIntoViewIfNeeded();
    await expect(lastSection).toHaveAttribute('data-reveal', 'done');
    await expect(lastSection).toHaveCSS('opacity', '1');
  });
});

test.describe('Scroll on navigation (T40)', () => {
  test('navigating to a page starts it at the top, not at the old scroll offset', async ({ mockPage: page }) => {
    // A tall page that is scrolled down, navigating to another page tall enough to keep a scroll offset.
    await page.goto('/playground');
    for (let i = 0; i < 8; i++) await page.getByRole('button', { name: /Add another cURL/i }).click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(1000);

    await page.getByRole('banner').getByRole('link', { name: 'Feedback' }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(900); // the offset would survive
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('Footer links (T35)', () => {
  test('Feedback, GitHub and nataraaj.dev are in the footer on every page', async ({ mockPage: page }) => {
    for (const path of ['/', '/playground', '/feedback', '/no-such-page']) {
      await page.goto(path);
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByRole('link', { name: 'Feedback' })).toHaveAttribute('href', '/feedback');
      await expect(footer.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', /github\.com\/Nataraaj-Shanmugam/);
      await expect(footer.getByRole('link', { name: /nataraaj\.dev/ })).toHaveAttribute('href', 'https://nataraaj.dev');
    }
  });
});
