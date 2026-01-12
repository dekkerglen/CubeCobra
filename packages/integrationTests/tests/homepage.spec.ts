import { expect, test } from '@playwright/test';

// Example: Homepage test migrated from Gherkin

test.describe('Homepage', () => {
  test('should display the correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cube Cobra/i);
  });

  // Add more homepage-related tests here
});
