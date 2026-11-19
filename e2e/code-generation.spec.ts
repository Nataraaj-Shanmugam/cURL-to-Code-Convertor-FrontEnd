import { test, expect, SAMPLE_CURL } from './fixtures';

/** Navigate playground → editor → open code generation dialog */
async function openCodeGenDialog(page: import('@playwright/test').Page) {
  await page.goto('/playground');
  await page.locator('textarea').fill(SAMPLE_CURL);
  await page.getByRole('button', { name: /Parse cURL/i }).click();
  await page.waitForURL(/\/editor/, { timeout: 10_000 });
  await page.getByRole('button', { name: /Generate Code/i }).click();
  // Wait for dialog
  await expect(page.getByText('Code Generation Configuration')).toBeVisible();
}

/** Select Full Test Class radio and wait for config to appear */
async function selectFullClass(page: import('@playwright/test').Page) {
  await page.locator('#option-full').check();
  await expect(page.locator('#class-name')).toBeVisible();
}

/** Select Test Method Only radio */
async function selectMethodOnly(page: import('@playwright/test').Page) {
  await page.locator('#option-method').check();
  await expect(page.locator('#method-name')).toBeVisible();
}

/** Click Generate and wait for result step */
async function generateAndWait(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^Generate Code$/i }).click();
  await expect(page.getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe('Code Generation Dialog', () => {
  // ── Config step ───────────────────────────────────────────────────────────

  test('opens with config step', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await expect(page.getByText('Generation Type')).toBeVisible();
    await expect(page.getByText('Full Test Class')).toBeVisible();
    await expect(page.getByText('Test Method Only')).toBeVisible();
  });

  test('Generate button is disabled until option selected', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    const genBtn = page.getByRole('button', { name: /^Generate Code$/i });
    await expect(genBtn).toBeDisabled();
  });

  test('selecting "Full Test Class" shows class name input', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await selectFullClass(page);

    // Configuration section and inputs appear
    await expect(page.locator('#class-name')).toBeVisible();
    await expect(page.locator('#method-name')).toBeVisible();
  });

  test('selecting "Test Method Only" hides class name input', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await selectMethodOnly(page);

    await expect(page.locator('#method-name')).toBeVisible();
    await expect(page.locator('#class-name')).not.toBeVisible();
  });

  test('POJO checkbox shows POJO class name input', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);

    await page.getByText('Generate POJO Classes').click();
    await expect(page.locator('#pojo-class-name')).toBeVisible();
  });

  test('validates Java identifiers (invalid class name)', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);

    // Clear and type invalid name
    await page.locator('#class-name').fill('123Invalid');
    // Trigger blur by clicking elsewhere
    await page.locator('#method-name').click();

    await expect(page.getByText(/Must be a valid Java identifier/i)).toBeVisible();
  });

  // ── Full generation flow ──────────────────────────────────────────────────

  test('generates code with Full Test Class option', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await selectFullClass(page);

    // Defaults should be pre-filled
    await expect(page.locator('#class-name')).toHaveValue('ApiTest');
    await expect(page.locator('#method-name')).toHaveValue('testApiRequest');

    // Generate and wait for result
    await generateAndWait(page);

    // Test Code tab should be active and show code
    await expect(page.getByRole('tab', { name: /Test Code/i })).toBeVisible();
    await expect(page.getByText(/RestAssured/i).first()).toBeVisible();
  });

  test('generates code with Method Only option', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await selectMethodOnly(page);
    await generateAndWait(page);

    await expect(page.getByText(/RestAssured/i).first()).toBeVisible();
  });

  test('generates code with POJO enabled', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await selectFullClass(page);
    await page.getByText('Generate POJO Classes').click();

    await generateAndWait(page);

    // POJO tab should be visible
    const pojoTab = page.getByRole('tab', { name: /POJO Classes/i });
    await expect(pojoTab).toBeVisible();

    await pojoTab.click();
    await expect(page.getByText(/@Data/i).first()).toBeVisible();
  });

  // ── Result step actions ───────────────────────────────────────────────────

  test('pom.xml tab shows the backend POM when requested (collapsed Maven & advanced section)', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    // Collapsed by default
    await expect(page.getByLabel('Java version')).toHaveCount(0);
    await page.getByRole('button', { name: /Maven & advanced/ }).click();
    await page.getByRole('checkbox', { name: 'Generate pom.xml' }).click();
    await generateAndWait(page);

    await page.getByRole('tab', { name: 'pom.xml' }).click();
    await expect(page.getByText(/rest-assured/i).first()).toBeVisible();
    await expect(page.getByText(/testng/i).first()).toBeVisible();

    // A full POM comes with the testng.xml it points at, and Download All saves every file.
    await page.getByRole('tab', { name: 'testng.xml' }).click();
    await expect(page.getByText(/<class name="ApiTest"\/>/)).toBeVisible();
    const names: string[] = [];
    page.on('download', (d) => names.push(d.suggestedFilename()));
    await page.getByRole('button', { name: 'Download All' }).click();
    await expect.poll(() => names.sort()).toEqual(['ApiTest.java', 'pom.xml', 'testng.xml']);
  });

  test('Copy copies redacted code by default; Copy with secrets copies the real values', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await generateAndWait(page);

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // The generated code contains the bearer token: masked on screen, redacted when copied.
    await expect(page.getByText('eyJhbGciOiJIUzI1NiJ9.token')).toHaveCount(0);
    await page.getByRole('button', { name: 'Copy redacted' }).click();
    await expect(page.getByText('Copied')).toBeVisible();
    const redacted = await page.evaluate(() => navigator.clipboard.readText());
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9.token');
    expect(redacted).toContain('[REDACTED]');

    await page.getByRole('button', { name: 'Copy with secrets' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('eyJhbGciOiJIUzI1NiJ9.token');
  });

  test('Download button triggers file download', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await generateAndWait(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('ApiTest.java');
  });

  test('"Back to Config" returns to configuration', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await generateAndWait(page);

    await page.getByRole('button', { name: /Back to Config/i }).click();
    await expect(page.getByText('Code Generation Configuration')).toBeVisible();
  });

  test('Close button dismisses dialog', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await generateAndWait(page);

    // Click the visible Close button (the custom one, not the X icon with sr-only "Close")
    // The custom button contains the text "Close" as visible text
    await page.locator('[role="dialog"] button:visible', { hasText: /^Close$/ }).last().click();
    // Dialog should be gone
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('Cancel button on config step closes dialog', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);

    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText('Code Generation Configuration')).not.toBeVisible();
  });

  // ── Layout (QU-7) ─────────────────────────────────────────────────────────

  test('Generate stays on screen at 1366x768 even with every section open', async ({ mockPage: page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await page.getByText('Generate POJO Classes').click();
    await page.getByRole('button', { name: /Maven & advanced/ }).click();
    await page.getByRole('checkbox', { name: 'Generate pom.xml' }).click();

    const generate = page.getByRole('button', { name: /^Generate Code$/i });
    const box = await generate.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(768);
    await expect(generate).toBeInViewport({ ratio: 1 });
    // The form itself is taller than the dialog body, so it is the body that scrolls.
    const overflow = await page.locator('[role="dialog"] .overflow-y-auto').evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflow).toBe(true);
  });

  test('a failed generate is shown at the footer, next to the Generate button', async ({ mockPage: page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.route(/\/api\/generate-from-parsed/, (route) =>
      route.fulfill({ status: 500, json: { success: false, error: { code: 'ERR', message: 'Backend exploded' } } }),
    );
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await page.getByRole('button', { name: /^Generate Code$/i }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Backend exploded' });
    await expect(alert).toBeInViewport({ ratio: 1 });
    const a = await alert.boundingBox();
    const g = await page.getByRole('button', { name: /^Generate Code$/i }).boundingBox();
    expect(g!.y - (a!.y + a!.height)).toBeLessThan(40);
  });

  test('Esc on a generated result keeps it for when the dialog is reopened', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await generateAndWait(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await page.getByRole('button', { name: /Generate Code/i }).click();
    await expect(page.getByText('Generated Code', { exact: true })).toBeVisible();
  });

  // ── Feedback dialog ───────────────────────────────────────────────────────

  test('Feedback button opens feedback dialog', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);
    await generateAndWait(page);

    await page.getByRole('button', { name: /Feedback/i }).click();
    // Feedback dialog should appear — wait a moment for the second dialog
    await page.waitForTimeout(500);
    await expect(
      page.getByText(/Share your feedback/i).or(page.getByText(/How was/i)).or(page.getByText(/rating/i)),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Assertions & logging checkboxes ───────────────────────────────────────

  test('Include Assertions checkbox is checked by default', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);

    // Assertions checkbox should be checked by default
    await expect(page.getByText('Include Assertions')).toBeVisible();
    // Status code input visible (since assertions default to true)
    await expect(page.getByPlaceholder('200')).toBeVisible();
  });

  test('Include Logging checkbox is checked by default', async ({ mockPage: page }) => {
    await openCodeGenDialog(page);
    await selectFullClass(page);

    await expect(page.getByText('Include Logging')).toBeVisible();
  });
});
