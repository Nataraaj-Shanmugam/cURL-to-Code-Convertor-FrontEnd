import { test, expect } from './fixtures';

test.describe('Home Page', () => {
  test('renders hero section with title and CTA', async ({ mockPage: page }) => {
    await page.goto('/');

    // Hero title
    await expect(page.getByRole('heading', { name: /cURLCraft/i })).toBeVisible();
    await expect(page.getByText(/Transform cURL commands/i)).toBeVisible();

    // Get Started CTA
    const getStartedBtn = page.getByRole('button', { name: /Get Started/i });
    await expect(getStartedBtn).toBeVisible();
  });

  test('renders all feature cards', async ({ mockPage: page }) => {
    await page.goto('/');

    const featureTitles = [
      'Smart cURL Parsing',
      'Visual Editor',
      'Code Generation',
      'Advanced Body Editor',
      'POJO Generation',
      'Maven Dependencies',
    ];

    for (const title of featureTitles) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test('renders How It Works section', async ({ mockPage: page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /How It Works/i })).toBeVisible();
    await expect(page.getByText('Paste your cURL command')).toBeVisible();
    await expect(page.getByText('Review & Edit')).toBeVisible();
    await expect(page.getByText('Configure Generation')).toBeVisible();
    await expect(page.getByText('Export Code')).toBeVisible();
  });

  test('renders capabilities checklist', async ({ mockPage: page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /What You Can Do/i })).toBeVisible();
    await expect(page.getByText(/All HTTP methods/i)).toBeVisible();
    await expect(page.getByText('Automatic POJO creation with Lombok')).toBeVisible();
  });

  test('"Get Started" navigates to /playground', async ({ mockPage: page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Get Started/i }).click();
    await expect(page).toHaveURL(/\/playground/);
  });

  test('"Open Playground" CTA navigates to /playground', async ({ mockPage: page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Open Playground/i }).click();
    await expect(page).toHaveURL(/\/playground/);
  });

  test('sets document title', async ({ mockPage: page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/cURLCraft Assured/i);
  });

  test('fires health check on mount', async ({ mockPage: page }) => {
    const healthReq = page.waitForRequest('**/api/health');
    await page.goto('/');
    await healthReq;
  });
});
