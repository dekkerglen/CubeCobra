import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { createCube, deleteCube } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { navigateToDashboard } from '../helpers/navigationActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Dashboard', () => {
  const testUser = getTestUser();
  let cubeId: string;
  const cubeName = `Dashboard Test Cube ${Date.now()}`;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    cubeId = await createCube(page, cubeName);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);
    await page.close();
  });

  test('6.1 - Dashboard loads and shows Your Cubes section', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToDashboard(page);

    // The dashboard should show the user's cube
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('6.2 - Dashboard shows feed section', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToDashboard(page);

    // The dashboard should have a feed area or latest content section
    // Dashboard shows "Feed (0)" or "Latest Content" or "Featured Cubes"
    const feedOrContent = page.getByText(/Feed|Latest Content|Featured/).first();
    await expect(feedOrContent).toBeVisible({ timeout: 10000 });
  });

  test('6.3 - Dashboard cube links to the cube page', async ({ page }) => {
    await login(page, testUser.username, testUser.password);
    await navigateToDashboard(page);

    // The cube link may be behind an ad/donation banner overlay (bg-advert).
    // Dismiss any overlay first by scrolling past it, then use force click.
    const cubeLink = page.locator(`a[href*="/cube/list/${cubeId}"]`).first();
    await cubeLink.waitFor({ state: 'visible', timeout: 10000 });
    await cubeLink.scrollIntoViewIfNeeded();

    // Use JS navigation to avoid ad overlay intercepting clicks
    const href = await cubeLink.getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: 'domcontentloaded' });

    // Should land on a cube page
    await expect(page).toHaveURL(/\/cube\//);
  });

  test('6.4 - Navigate to dashboard via logo click', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // First go somewhere else (e.g. explore)
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });

    // Click the logo to go back to dashboard
    await navigateToDashboard(page);

    // Should be back at dashboard or '/'
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });
});
