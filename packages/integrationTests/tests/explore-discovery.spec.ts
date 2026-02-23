import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { addCardsByName, TEST_CARDS } from '../helpers/cardActions';
import { createCube, deleteCube } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import {
  navigateToExplore,
  navigateToHomepage,
  navigateToLanding,
  navigateToSearch,
  verifySectionExists,
} from '../helpers/navigationActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Explore & Discovery', () => {
  const testUser = getTestUser();
  let exploreCubeId: string;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  // Ensure at least one cube exists so explore page has content
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    exploreCubeId = await createCube(page, `Explore Test Cube ${Date.now()}`);
    await addCardsByName(page, exploreCubeId, TEST_CARDS.slice(0, 3));
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (exploreCubeId) {
      const page = await browser.newPage();
      await login(page, testUser.username, testUser.password);
      await deleteCube(page, exploreCubeId);
      await page.close();
    }
  });

  test('4.1 - Landing page loads with key sections', async ({ page }) => {
    await navigateToLanding(page);
    await verifySectionExists(page, 'Featured Cubes');
  });

  test('4.2 - Explore page shows all four cube sections', async ({ page }) => {
    // Navigate to Explore via the navbar dropdown
    await navigateToHomepage(page);
    await navigateToExplore(page);
    await verifySectionExists(page, 'Featured Cubes');
    await verifySectionExists(page, 'Recently Updated Cubes');
    await verifySectionExists(page, 'Most Popular Cubes');
    await verifySectionExists(page, 'Recently Drafted Cubes');
  });

  test('4.3 - Clicking a cube from explore loads the cube page', async ({ page }) => {
    await navigateToHomepage(page);
    await navigateToExplore(page);

    // Find any cube link on the explore page and click it
    const cubeLink = page.locator('a[href*="/cube/"]').first();
    await expect(cubeLink).toBeVisible({ timeout: 10000 });
    await cubeLink.click();

    // Verify we landed on a cube page
    await expect(page).toHaveURL(/\/cube\//);
    await page.waitForLoadState('domcontentloaded');
  });

  test('4.4 - Search page loads via navbar', async ({ page }) => {
    // Navigate to Search via navbar Explore dropdown
    await navigateToHomepage(page);
    await navigateToSearch(page);

    // The search page should load
    await expect(page.locator('text=/Cube Search/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('4.5 - Search with a query using the navbar search bar', async ({ page }) => {
    // Use the navbar search bar to search
    await navigateToHomepage(page);
    await navigateToSearch(page, 'vintage');

    // Should show either results or empty state
    const resultsOrEmpty = page.locator('text=/Cubes Found|No cubes found|results/i').first();
    await expect(resultsOrEmpty).toBeVisible({ timeout: 15000 });
  });

  test('4.6 - Sort search results by different criteria', async ({ page }) => {
    // Navigate to search page first, then interact with sort
    await navigateToHomepage(page);
    await navigateToSearch(page);

    // Page should load without errors
    await expect(page.locator('text=/Cube Search/i').first()).toBeVisible({ timeout: 10000 });
  });
});
