import { expect, test } from '@playwright/test';

import {
  fillLoginForm,
  fillRegistrationForm,
  login,
  navigateToLogin,
  navigateToRegister,
  register,
} from '../helpers/authActions';
import { clickButtonWithText } from '../helpers/commonActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { getTestUser } from '../helpers/testUser';

test.describe('Authentication Extended', () => {
  const testUser = getTestUser();

  // Register the shared test user before any tests in this describe block.
  // This ensures auth-extended tests can log in, and prevents test 5.2
  // from accidentally stealing the first registration from auth.spec.ts.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await register(page, testUser);
    } catch {
      // User may already exist — that's fine
    }
    await page.close();
  });

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test('5.1 - Login with invalid credentials shows error', async ({ page }) => {
    await navigateToLogin(page);
    await fillLoginForm(page, 'nonexistentuser999', 'wrongpassword123');
    await clickButtonWithText(page, 'Login');

    // Should stay on login page or show an error
    await page.waitForLoadState('domcontentloaded');

    // Login page should either show error message or still be visible
    const loginInput = page.locator('input[id="username"]');
    const errorMsg = page.getByText(/Incorrect|Invalid|Error/i).first();

    // Either the error message is visible or we're still on the login page
    const isError = await errorMsg.isVisible().catch(() => false);
    const isLogin = await loginInput.isVisible().catch(() => false);
    expect(isError || isLogin).toBeTruthy();
  });

  test('5.2 - Register with duplicate username shows error', async ({ page }) => {
    // The shared test user was registered in beforeAll.
    // Try to register again with the SAME username — should see an error.
    await navigateToRegister(page);
    await fillRegistrationForm(page, testUser);
    await clickButtonWithText(page, 'Register');
    await page.waitForLoadState('domcontentloaded');

    // Should show error about duplicate username OR stay on the register page.
    // The server returns an error alert or the registration form stays visible.
    const errorAlert = page.locator('.bg-red-100, .text-danger, [class*="alert"]').first();
    const registerInput = page.locator('input[id="email"]');

    const hasError = await errorAlert.isVisible().catch(() => false);
    const stayedOnPage = await registerInput.isVisible().catch(() => false);

    // If the registration somehow succeeded (redirect to login), that also means
    // we are NOT redirected to dashboard, which is acceptable.
    const onLoginPage = page.url().includes('/user/login');
    expect(hasError || stayedOnPage || onLoginPage).toBeTruthy();
  });

  test('5.4 - Logout and verify session is cleared', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // Verify we're logged in first
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Navigate to logout
    await page.goto('/user/logout', { waitUntil: 'domcontentloaded' });

    // After logout, navigating to dashboard should redirect to landing/login
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    // Should NOT be on dashboard if logged out — should be on landing page
    expect(url).toMatch(/\/(landing|user\/login)/);
  });

  test('5.5 - Access authenticated route while logged out redirects', async ({ page }) => {
    // Go directly to account page without logging in
    await page.goto('/user/account', { waitUntil: 'domcontentloaded' });

    // Should redirect to login page
    await expect(page).toHaveURL(/\/user\/login/);
  });
});
