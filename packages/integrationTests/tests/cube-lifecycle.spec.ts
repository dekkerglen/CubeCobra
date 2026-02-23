import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { createCube, deleteCube, navigateToCubeAbout } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { navigateToCubeFromNav, navigateToDashboard } from '../helpers/navigationActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Cube Lifecycle', () => {
  const testUser = getTestUser();
  let cubeId: string;
  const cubeName = `Test Cube ${Date.now()}`;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test('1.1 - Create a new cube', async ({ page }) => {
    // Login first (user was registered by auth.spec.ts which runs before this)
    await login(page, testUser.username, testUser.password);

    // Create a cube (API call — this is CRUD, not navigation)
    cubeId = await createCube(page, cubeName);
    expect(cubeId).toBeTruthy();
    expect(cubeId.length).toBeGreaterThan(0);
  });

  test('1.2 - New cube appears on the dashboard', async ({ page }) => {
    test.skip(!cubeId, 'Cube was not created in previous test');

    await login(page, testUser.username, testUser.password);
    // Click the logo to go to dashboard
    await navigateToDashboard(page);

    // The cube name should appear somewhere on the dashboard
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('1.3 - Cube about page shows correct name', async ({ page }) => {
    test.skip(!cubeId, 'Cube was not created in previous test');

    await login(page, testUser.username, testUser.password);

    // Navigate to the cube via the "Your Cubes" navbar dropdown
    await navigateToCubeFromNav(page, cubeName);
    // Now we're on the cube list page — click "About" in the sidebar
    await navigateToCubeAbout(page);

    // Verify the cube name is displayed
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('1.4 - Cube list page loads (empty state)', async ({ page }) => {
    test.skip(!cubeId, 'Cube was not created in previous test');

    await login(page, testUser.username, testUser.password);

    // Navigate to the cube via "Your Cubes" dropdown (lands on list page)
    await navigateToCubeFromNav(page, cubeName);

    // The page should load without errors - look for the cube name in the header
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('1.5 - Delete the cube', async ({ page }) => {
    test.skip(!cubeId, 'Cube was not created in previous test');

    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);

    // Navigate to dashboard via logo click and verify the cube is gone
    await navigateToDashboard(page);
    await page.waitForLoadState('networkidle');

    // The cube name should no longer be visible
    const cubeElement = page.locator(`text=${cubeName}`);
    await expect(cubeElement).toHaveCount(0, { timeout: 5000 });
  });
});
