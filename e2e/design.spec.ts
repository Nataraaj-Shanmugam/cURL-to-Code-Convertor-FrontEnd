import AxeBuilder from '@axe-core/playwright';
import { test, expect, SAMPLE_CURL, MOCK_PARSED_CURL } from './fixtures';
import type { Page, Route } from '@playwright/test';

/**
 * Design and accessibility guard (audit D-1 .. D-16): axe on every main route and dialog in both
 * themes, plus the layout facts axe cannot see (390 px rows, focus, touch targets, chrome height).
 * The API is mocked, so this runs without a backend.
 */

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const WITH_SECRETS = {
  ...MOCK_PARSED_CURL,
  headers: { ...MOCK_PARSED_CURL.headers, 'X-Api-Key': 'sk_live_51H8abcDEFghiJKLmnoPQR' },
};

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => localStorage.setItem('ui-theme', t), theme);
  await page.emulateMedia({ colorScheme: theme });
}

/**
 * Waits for every finite CSS/Web animation to end (entrance fades, dialog zoom), so contrast is
 * measured on final colours. A fixed sleep was not enough on a loaded runner: the staggered Home
 * cards were caught mid fade-in. Infinite ones (spinners, pulses) are skipped, they never finish.
 */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function expectNoAxeViolations(page: Page, where: string) {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').split('\n')[1] ?? ''}`.slice(0, 240)),
  }));
  expect(summary, `axe violations on ${where}`).toEqual([]);
}

async function openEditor(page: Page, data: Record<string, unknown> = WITH_SECRETS) {
  await page.route(/\/api\/parse$/, (route: Route) => route.fulfill({ json: { success: true, data } }));
  await page.goto('/playground');
  await page.locator('textarea').first().fill(SAMPLE_CURL);
  await page.getByRole('button', { name: /Parse cURL/i }).click();
  await page.waitForURL(/\/editor/);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Parsed Request' })).toBeVisible();
}

async function openToolbar(page: Page, name: string | RegExp) {
  const direct = page.getByRole('button', { name }).first();
  if (await direct.isVisible()) return direct.click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

async function openBatch(page: Page) {
  await page.route(/\/api\/parse$/, async (route: Route) => {
    const { curl = '' } = JSON.parse(route.request().postData() ?? '{}');
    const method = /-X\s+(\w+)/.exec(curl)?.[1]?.toUpperCase() ?? 'GET';
    const path = /example\.com(\/[^\s"']*)/.exec(curl)?.[1] ?? '/';
    return route.fulfill({
      json: { success: true, data: { method, url: `https://api.example.com${path}`, base_url: 'https://api.example.com', endpoint: path, headers: { Accept: 'application/json' } } },
    });
  });
  await page.goto('/playground');
  const curls = [
    'curl -X GET "https://api.example.com/users/1"',
    'curl -X POST "https://api.example.com/users" -d \'{"a":1}\'',
    'curl -X DELETE "https://api.example.com/users/9"',
  ];
  for (let i = 1; i < curls.length; i++) await page.getByText('Add another cURL').click();
  for (let i = 0; i < curls.length; i++) await page.locator('textarea').nth(i).fill(curls[i]!);
  await page.getByRole('button', { name: /Parse All/ }).click();
  await page.waitForURL(/batch-editor/);
  await expect(page.getByRole('list', { name: 'Requests' }).or(page.getByLabel('Request', { exact: true })).first()).toBeAttached();
}

const STATES: Record<string, (page: Page) => Promise<void>> = {
  home: async (page) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  },
  playground: async (page) => {
    await page.goto('/playground');
    await expect(page.getByRole('heading', { level: 1, name: 'cURL Playground' })).toBeVisible();
  },
  'playground-multi-examples': async (page) => {
    await page.goto('/playground');
    await page.getByText('Add another cURL').click();
    await expect(page.getByText('Try an example:')).toBeVisible();
  },
  'import-dialog': async (page) => {
    await page.goto('/playground');
    await page.getByRole('button', { name: /Import/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  },
  editor: async (page) => openEditor(page),
  'editor-original-open': async (page) => {
    await openEditor(page);
    await page.getByRole('button', { name: /Original cURL Command/ }).click();
  },
  'request-preview': async (page) => {
    await openEditor(page);
    await openToolbar(page, /Preview/);
    await page.getByRole('button', { name: /Reconstructed cURL/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  },
  export: async (page) => {
    await openEditor(page);
    await openToolbar(page, /Export/);
    await expect(page.getByRole('dialog')).toBeVisible();
  },
  'review-changes': async (page) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Edit endpoint' }).click({ force: true });
    await page.getByLabel('Value of endpoint').fill('/users/42');
    await page.getByRole('button', { name: 'Save endpoint' }).click({ force: true });
    await openToolbar(page, /Changes/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('tab', { name: 'Raw JSON' }).click();
  },
  'codegen-form': async (page) => {
    await openEditor(page);
    await page.getByRole('button', { name: /Generate Code/ }).first().click();
    await page.getByRole('radio', { name: 'Full Test Class' }).click();
    await page.getByRole('button', { name: /Maven/ }).click();
  },
  'codegen-result': async (page) => {
    await openEditor(page);
    await page.getByRole('button', { name: /Generate Code/ }).first().click();
    await page.getByRole('radio', { name: 'Full Test Class' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Generate Code$/ }).click();
    await expect(page.getByText('Generated Code', { exact: true })).toBeVisible();
  },
  batch: async (page) => openBatch(page),
  'batch-generate-all': async (page) => {
    await openBatch(page);
    await page.getByRole('button', { name: 'Generate All' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  },
  feedback: async (page) => {
    await page.goto('/feedback');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  },
  'not-found': async (page) => {
    await page.goto('/nope');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  },
};

for (const theme of THEMES) {
  test.describe(`axe, ${theme} theme, desktop`, () => {
    for (const [name, open] of Object.entries(STATES)) {
      test(name, async ({ mockPage: page }) => {
        await setTheme(page, theme);
        await open(page);
        await expectNoAxeViolations(page, `${name} (${theme})`);
      });
    }
  });
}

test.describe('axe, mobile (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  for (const theme of THEMES) {
    for (const name of ['playground', 'editor', 'request-preview', 'codegen-result', 'batch', 'batch-generate-all']) {
      test(`${name} (${theme})`, async ({ mockPage: page }) => {
        await setTheme(page, theme);
        await STATES[name]!(page);
        await page.waitForTimeout(400);
        await expectNoAxeViolations(page, `${name} (${theme}, 390px)`);
      });
    }
  }
});

test.describe('D-4 headings while loading', () => {
  test('/batch-editor has an h1 before its chunk has loaded', async ({ mockPage: page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/BatchEditorPage/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/batch-editor', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const results = await new AxeBuilder({ page }).withRules(['page-has-heading-one', 'heading-order']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    release();
    await expect(page.getByRole('heading', { level: 1, name: 'Batch editor' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});

test.describe('D-5 / D-6 backend status', () => {
  test('one status chip on /playground, and a banner explains Unavailable with Retry', async ({ mockPage: page }) => {
    let up = false;
    await page.route(/\/api\/health/, (route) =>
      up ? route.fulfill({ json: { status: 'ok' } }) : route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>503</h1>' }),
    );
    await page.clock.install();
    await page.goto('/playground');
    await expect(page.getByTestId('backend-status-banner')).toContainText('waking up');
    await expect
      .poll(async () => {
        await page.clock.runFor(15_000);
        return page.getByTestId('backend-status-nav').getAttribute('data-status');
      }, { timeout: 20_000, intervals: [50] })
      .toBe('unavailable');

    await expect(page.locator('[data-testid^="backend-status-"]:visible[data-status]')).toHaveCount(1);
    const banner = page.getByTestId('backend-status-banner');
    await expect(banner).toContainText('Generator unavailable');
    await expectNoAxeViolations(page, 'playground, unavailable');

    up = true;
    await banner.getByRole('button', { name: 'Retry connection' }).click();
    await expect(page.getByTestId('backend-status-nav')).toHaveAttribute('data-status', 'ready');
    await expect(banner).toHaveCount(0);
  });
});

test.describe('D-12 / D-13 / D-14 desktop layout and focus', () => {
  test('the Playground focuses its cURL box', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await expect(page.locator('textarea').first()).toBeFocused();
  });

  test('editor chrome is compact: the first section starts high on the page', async ({ mockPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openEditor(page);
    const top = await page.getByRole('heading', { level: 1, name: 'Edit Parsed Request' }).evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(300); // was ~420 with a banner, a card and a toolbar above it
    await expect(page.getByRole('region', { name: 'Original request' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear saved request' })).toBeVisible();
  });

  test('dialogs open on their heading, not an eye button or a checkbox', async ({ mockPage: page }) => {
    await openEditor(page);
    await openToolbar(page, /Preview/);
    await expect(page.getByRole('heading', { name: 'Request Preview' })).toBeFocused();
    await page.keyboard.press('Escape');
    await openToolbar(page, /Export/);
    await expect(page.getByRole('heading', { name: 'Export JSON' })).toBeFocused();
  });
});

test.describe('D-8 / D-15 mobile layout (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('editor rows are stacked and full width, with no mid-word breaks', async ({ mockPage: page }) => {
    await openEditor(page, { ...WITH_SECRETS, headers: { 'Content-Type': 'application/json' } });
    await expect(page.getByRole('button', { name: 'Headers', exact: true })).toHaveAttribute('aria-expanded', 'true');
    const value = page.locator('pre', { hasText: 'application/json' }).first();
    const box = (await value.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);
    // One line: the text is not broken across lines in the middle of a word.
    const lines = await value.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
    });
    expect(lines).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('primary actions and footer links are at least 40px tall', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await page.locator('textarea').first().fill(SAMPLE_CURL);
    for (const name of [/Parse cURL/, /^Reset$/, /Import/]) {
      const box = (await page.getByRole('button', { name }).first().boundingBox())!;
      expect(box.height, String(name)).toBeGreaterThanOrEqual(40);
    }
    for (const link of await page.getByRole('navigation', { name: 'Footer' }).getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    await openEditor(page);
    for (const name of [/Generate Code/, /Preview/, /^Reset$/]) {
      const box = (await page.getByRole('button', { name }).first().boundingBox())!;
      expect(box.height, String(name)).toBeGreaterThanOrEqual(40);
    }
  });
});
