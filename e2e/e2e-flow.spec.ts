import { test, expect, SAMPLE_CURL } from './fixtures';

/**
 * Full end-to-end user journeys that traverse multiple pages,
 * simulating real user workflows from start to finish.
 */

test.describe('E2E: Complete User Journeys', () => {
  test('Journey 1: Home → Playground → Parse → Editor → Generate Full Class → Copy → Close', async ({
    mockPage: page,
  }) => {
    // Step 1: Start on Home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /cURLCraft/i })).toBeVisible();

    // Step 2: Click "Get Started"
    await page.getByRole('button', { name: /Get Started/i }).click();
    await expect(page).toHaveURL(/\/playground/);

    // Step 3: Paste cURL and parse
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });

    // Step 4: Verify editor loaded
    await expect(page.getByText('POST').first()).toBeVisible();
    await expect(page.getByText('/users').first()).toBeVisible();

    // Step 5: Open Code Generation dialog
    await page.getByRole('button', { name: /Generate Code/i }).click();
    await expect(page.getByText('Code Generation Configuration')).toBeVisible();

    // Step 6: Configure - Full Test Class
    await page.locator('#option-full').check();
    await expect(page.locator('#class-name')).toHaveValue('ApiTest');

    // Step 7: Generate
    await page.getByRole('button', { name: /^Generate Code$/i }).click();
    await expect(page.getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Step 8: Verify test code is displayed
    await expect(page.getByText(/RestAssured/i).first()).toBeVisible();

    // Step 9: Copy
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /Copy/i }).click();
    await expect(page.getByText('Copied')).toBeVisible();

    // Step 10: Close dialog — click the visible "Close" button (not the X icon)
    await page.locator('[role="dialog"] button:visible', { hasText: /^Close$/ }).last().click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Step 11: Back to playground
    const backBtn = page.getByRole('button', { name: /Back/i }).or(page.locator('button:has-text("←")'));
    await backBtn.first().click();
    await expect(page).toHaveURL(/\/playground/);
  });

  test('Journey 2: Playground example → Parse → Editor → Generate with POJO → Download', async ({
    mockPage: page,
  }) => {
    // Step 1: Go to playground
    await page.goto('/playground');

    // Step 2: Click an example cURL
    await page.getByText('POST with JSON Body').click();
    const textarea = page.locator('textarea');
    await expect(textarea).not.toHaveValue('');

    // Step 3: Parse
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });

    // Step 4: Try Preview if available
    const previewBtn = page.getByRole('button', { name: /Preview/i });
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      // Close preview via Escape
      await page.keyboard.press('Escape');
      // Wait for dialog to close
      await page.waitForTimeout(300);
    }

    // Step 5: Open code generation
    await page.getByRole('button', { name: /Generate Code/i }).click();
    await expect(page.getByText('Code Generation Configuration')).toBeVisible();

    // Step 6: Full class + POJO
    await page.locator('#option-full').check();
    await page.getByText('Generate POJO Classes').click();

    // Step 7: Generate
    await page.getByRole('button', { name: /^Generate Code$/i }).click();
    await expect(page.getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Step 8: Check POJO tab
    const pojoTab = page.getByRole('tab', { name: /POJO/i });
    await expect(pojoTab).toBeVisible();
    await pojoTab.click();
    await expect(page.getByText(/@Data/i).first()).toBeVisible();

    // Step 9: Download test code
    await page.getByRole('tab', { name: /Test Code/i }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('ApiTest.java');
  });

  test('Journey 3: Playground → batch mode → multi-cURL UI → navigation', async ({
    mockPage: page,
  }) => {
    const CURL_GET =
      'curl -X GET "https://api.example.com/users" -H "Accept: application/json"';

    // Step 1: Go to playground
    await page.goto('/playground');

    // Step 2: Add second cURL
    await page.getByText('Add another cURL').click();
    await expect(page.locator('textarea')).toHaveCount(2);

    // Step 3: Fill both
    await page.locator('textarea').first().fill(SAMPLE_CURL);
    await page.locator('textarea').nth(1).fill(CURL_GET);

    // Step 4: Verify multi-mode UI
    await expect(page.getByText(/2 commands/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Parse All \(2\)/i })).toBeVisible();

    // Step 5: Parse All → arrives at batch-editor URL
    await page.getByRole('button', { name: /Parse All/i }).click();
    await expect(page).toHaveURL(/\/batch-editor/, { timeout: 10_000 });

    // Step 6: Go back to playground (use browser back or direct nav)
    await page.goto('/playground');
    await expect(page).toHaveURL(/\/playground/);
  });

  test('Journey 4: Error recovery — invalid cURL → fix → parse successfully', async ({
    mockPage: page,
  }) => {
    await page.goto('/playground');

    // Step 1: Enter invalid cURL
    await page.locator('textarea').fill('invalid-curl-garbage');
    await page.getByRole('button', { name: /Parse cURL/i }).click();

    // Step 2: Error shown
    await expect(page.getByText('Invalid cURL command format', { exact: true })).toBeVisible();

    // Step 3: Fix the cURL
    await page.locator('textarea').fill(SAMPLE_CURL);

    // Step 4: Parse successfully
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });
  });

  test('Journey 5: Keyboard shortcut parse', async ({ mockPage: page }) => {
    await page.goto('/playground');

    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.keyboard.press('Control+Enter');

    await expect(page).toHaveURL(/\/editor/, { timeout: 10_000 });
    await expect(page.getByText('POST').first()).toBeVisible();
  });
});
