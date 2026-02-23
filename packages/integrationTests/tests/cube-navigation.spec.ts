import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { addCardsByName, TEST_CARDS } from '../helpers/cardActions';
import {
  createCube,
  deleteCube,
  navigateToCubeAbout,
  navigateToCubeList,
  navigateToCubePlaytest,
  navigateToCubeSettings,
} from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { navigateToCubeFromNav } from '../helpers/navigationActions';
import { getTestUser } from '../helpers/testUser';

/**
 * Navigate to a cube's analysis page using the sidebar.
 */
async function navigateToCubeAnalysis(page: import('@playwright/test').Page): Promise<void> {
  const link = page.locator('a[href*="/cube/analysis/"]').first();
  await link.waitFor({ state: 'visible', timeout: 10000 });
  const href = await link.getAttribute('href');
  if (href) {
    await page.goto(href, { waitUntil: 'domcontentloaded' });
  } else {
    await link.click({ force: true });
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * Navigate to a cube's records page using the sidebar.
 */
async function navigateToCubeRecords(page: import('@playwright/test').Page): Promise<void> {
  const link = page.locator('a[href*="/cube/records/"]').first();
  await link.waitFor({ state: 'visible', timeout: 10000 });
  const href = await link.getAttribute('href');
  if (href) {
    await page.goto(href, { waitUntil: 'domcontentloaded' });
  } else {
    await link.click({ force: true });
    await page.waitForLoadState('domcontentloaded');
  }
}

test.describe('Cube Navigation', () => {
  const testUser = getTestUser();
  let cubeId: string;
  const cubeName = `Nav Test Cube ${Date.now()}`;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    cubeId = await createCube(page, cubeName);
    // Add cards so analysis page has data
    await addCardsByName(page, cubeId, TEST_CARDS);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);
    await page.close();
  });

  test('7.1 - Navigate between cube sub-pages via sidebar', async ({ page }) => {
    test.setTimeout(60000); // 6 navigations need more time

    await login(page, testUser.username, testUser.password);
    // Navigate directly to cube list page (faster than dropdown)
    await page.goto(`/cube/list/${cubeId}`, { waitUntil: 'domcontentloaded' });

    // Should start on list page
    await expect(page).toHaveURL(/\/cube\/list\//);

    // Navigate to About
    await navigateToCubeAbout(page);
    await expect(page).toHaveURL(/\/cube\/about\//);

    // Navigate to Playtest
    await navigateToCubePlaytest(page);
    await expect(page).toHaveURL(/\/cube\/playtest\//);

    // Navigate to Analysis
    await navigateToCubeAnalysis(page);
    await expect(page).toHaveURL(/\/cube\/analysis\//);

    // Navigate to Records
    await navigateToCubeRecords(page);
    await expect(page).toHaveURL(/\/cube\/records\//);

    // Navigate back to List
    await navigateToCubeList(page);
    await expect(page).toHaveURL(/\/cube\/list\//);
  });

  test('7.2 - Cube About shows correct metadata', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeAbout(page);

    // Cube name should be visible in hero area
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });

    // Card count should appear (we added 15 cards)
    await expect(page.getByText('15 Card Cube').first()).toBeVisible({ timeout: 10000 });
  });

  test('7.3 - Cube List page shows cards in table view', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToCubeFromNav(page, cubeName);

    // Default view lands on list — verify some card names are visible
    await expect(page.getByText('Lightning Bolt').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Counterspell').first()).toBeVisible({ timeout: 5000 });
  });

  test('7.4 - Cube Analysis page loads with content', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeAnalysis(page);

    await expect(page).toHaveURL(/\/cube\/analysis\//);
    // Analysis page should have some header content
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('7.5 - Cube About page blog view loads', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeAbout(page);

    // Click Blog sub-view in sidebar
    const blogLink = page.locator('a[href*="?view=blog"]').first();
    await blogLink.waitFor({ state: 'visible', timeout: 10000 });
    await blogLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Should still be on the about page with blog view
    await expect(page).toHaveURL(/\/cube\/about\/.*\?view=blog/);
  });

  test('7.6 - Cube Settings page loads (owner only)', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeSettings(page);

    await expect(page).toHaveURL(/\/cube\/settings\//);
    // Settings page should show cube name
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
  });
});
