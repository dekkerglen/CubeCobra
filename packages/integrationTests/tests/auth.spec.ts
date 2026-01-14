import { expect, test } from '@playwright/test';

import {
  login,
  navigateToRegister,
  register,
  verifyLoginSuccess,
  verifyRegistrationSuccess,
  verifyUserLoggedIn,
} from '../helpers/authActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Authentication', () => {
  const testUser = getTestUser();

  console.log('Test user credentials:', {
    username: testUser.username,
    email: testUser.email,
    passwordLength: testUser.password.length,
  });

  test('should register a new account', async ({ page }) => {
    // Capture console messages for debugging
    page.on('console', (msg) => console.log('Browser console:', msg.text()));
    page.on('pageerror', (err) => console.error('Browser error:', err.message));

    console.log('Registering with username:', testUser.username);
    // Debug: Check if the page loaded
    await navigateToRegister(page);
    const bodyText = await page.locator('body').textContent();
    console.log('Page body text:', bodyText?.substring(0, 200));

    await register(page, testUser);
    await verifyRegistrationSuccess(page);
  });

  test('should login with the newly created account', async ({ page }) => {
    console.log('Logging in with username:', testUser.username);
    await login(page, testUser.username, testUser.password);
    await verifyLoginSuccess(page, testUser.username);
  });

  test('should maintain login session across page navigation', async ({ page }) => {
    // First login
    await login(page, testUser.username, testUser.password);
    await verifyLoginSuccess(page, testUser.username);

    // Navigate to different pages and verify session is maintained
    await page.goto('/explore');
    await verifyUserLoggedIn(page, testUser.username, 5000);

    // Navigate to account page
    await page.goto('/user/account');
    await expect(page).toHaveURL(/\/user\/account/);

    // Verify we can access authenticated routes
    const accountContent = page.locator('text=/Profile|Account/i').first();
    await expect(accountContent).toBeVisible();
  });
});
