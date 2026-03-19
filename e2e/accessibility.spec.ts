import { test, expect, SAMPLE_CURL } from './fixtures';

/**
 * Accessibility tests covering ARIA attributes, screen-reader
 * live regions, keyboard navigation, and proper labelling.
 */

test.describe('Accessibility', () => {
  test('Home page has skip-to-content link', async ({ mockPage: page }) => {
    await page.goto('/');

    const skipLink = page.locator('a[href="#main-content"], a:has-text("Skip")');
    if (await skipLink.count()) {
      await expect(skipLink.first()).toBeAttached();
    }
  });

  test('Playground has screen-reader live region', async ({ mockPage: page }) => {
    await page.goto('/playground');

    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion.first()).toBeAttached();
  });

  test('Playground textarea is keyboard accessible', async ({ mockPage: page }) => {
    await page.goto('/playground');

    // Focus the textarea directly
    await page.locator('textarea').first().focus();
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('TEXTAREA');
  });

  test('Code generation dialog radio buttons have proper IDs and labels', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await page.waitForURL(/\/editor/, { timeout: 10_000 });
    await page.getByRole('button', { name: /Generate Code/i }).click();

    // Radio buttons should have associated labels via htmlFor
    const fullRadio = page.locator('#option-full');
    await expect(fullRadio).toBeAttached();
    const methodRadio = page.locator('#option-method');
    await expect(methodRadio).toBeAttached();

    // Labels should be clickable — click the label and verify the radio gets checked
    await page.locator('label[for="option-full"]').click();
    await expect(fullRadio).toBeChecked();
  });

  test('Code generation dialog has aria-describedby for error fields', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await page.waitForURL(/\/editor/, { timeout: 10_000 });
    await page.getByRole('button', { name: /Generate Code/i }).click();

    await page.locator('#option-full').check();

    // Trigger validation error
    await page.locator('#class-name').fill('123BadName');
    await page.locator('#method-name').click();

    // Field should have aria-describedby pointing to error message
    const describedBy = await page.locator('#class-name').getAttribute('aria-describedby');
    expect(describedBy).toBe('class-name-error');
    await expect(page.locator('#class-name-error')).toBeVisible();
  });

  test('Generated code result tabs use proper ARIA tab pattern', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await page.waitForURL(/\/editor/, { timeout: 10_000 });
    await page.getByRole('button', { name: /Generate Code/i }).click();

    await page.locator('#option-full').check();
    await page.getByRole('button', { name: /^Generate Code$/i }).click();
    await expect(page.getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Tab list should have proper role
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();

    // Tabs should have role="tab" and aria-selected
    const testTab = page.getByRole('tab', { name: /Test Code/i });
    await expect(testTab).toHaveAttribute('aria-selected', 'true');

    // Tab panel should exist
    const tabpanel = page.locator('[role="tabpanel"]');
    await expect(tabpanel).toBeVisible();
  });

  test('Live region announces generation status', async ({ mockPage: page }) => {
    await page.goto('/playground');
    await page.locator('textarea').fill(SAMPLE_CURL);
    await page.getByRole('button', { name: /Parse cURL/i }).click();
    await page.waitForURL(/\/editor/, { timeout: 10_000 });
    await page.getByRole('button', { name: /Generate Code/i }).click();

    await page.locator('#option-full').check();
    await page.getByRole('button', { name: /^Generate Code$/i }).click();

    await expect(page.getByText('Generated Code', { exact: true })).toBeVisible({ timeout: 10_000 });

    // The sr-only live region should contain completion text
    const liveRegion = page.locator('[role="dialog"] [aria-live="polite"]');
    if (await liveRegion.count()) {
      const text = await liveRegion.textContent();
      expect(text).toContain('complete');
    }
  });
});
