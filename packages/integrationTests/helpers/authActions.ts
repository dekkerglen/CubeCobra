import { expect, Page } from '@playwright/test';

import { clickButtonWithText } from './commonActions';
import { TestUser } from './testUser';

/**
 * Navigate to the login page and wait for it to load
 */
export async function navigateToLogin(page: Page): Promise<void> {
  await page.goto('/user/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[id="username"]', { state: 'visible' });
}

/**
 * Navigate to the register page and wait for it to load
 */
export async function navigateToRegister(page: Page): Promise<void> {
  await page.goto('/user/register', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[id="email"]', { state: 'visible', timeout: 15000 });
}

/**
 * Fill in the login form with provided credentials
 */
export async function fillLoginForm(page: Page, username: string, password: string): Promise<void> {
  await page.fill('input[id="username"]', username);
  await page.fill('input[id="password"]', password);
}

/**
 * Fill in the registration form with provided user data
 */
export async function fillRegistrationForm(page: Page, user: TestUser): Promise<void> {
  await page.fill('input[id="email"]', user.email);
  await page.fill('input[id="username"]', user.username);
  await page.fill('input[id="password"]', user.password);
  await page.fill('input[id="password2"]', user.password);

  // Fill in the security question answer
  // The question is random, but common answers work for most questions
  await page.fill('input[id="answer"]', 'Mountain');
}

/**
 * Complete login flow: navigate, fill form, and submit
 */
export async function login(page: Page, username: string, password: string): Promise<void> {
  await navigateToLogin(page);
  await fillLoginForm(page, username, password);

  // Click login and wait for URL to change (either to dashboard or back to login on error)
  await Promise.all([
    page.waitForURL(/.*/, { timeout: 15000 }), // Wait for any URL change
    clickButtonWithText(page, 'Login'),
  ]);
}

/**
 * Complete registration flow: navigate, fill form, and submit
 */
export async function register(page: Page, user: TestUser): Promise<void> {
  await navigateToRegister(page);
  await fillRegistrationForm(page, user);

  // Click register and wait for redirect to login page
  await Promise.all([page.waitForURL(/\/user\/login/, { timeout: 15000 }), clickButtonWithText(page, 'Register')]);
}

/**
 * Verify user is logged in by checking for their username in the UI
 */
export async function verifyUserLoggedIn(page: Page, username: string, timeout: number = 10000): Promise<void> {
  // The username appears in a dropdown menu which might be hidden by default
  // So we just check that the element exists in the DOM
  const userMenu = page.locator(`text=${username}`).first();
  await expect(userMenu).toBeAttached({ timeout });
}

/**
 * Verify successful registration by checking for success message
 */
export async function verifyRegistrationSuccess(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/user\/login/);
  // Success alerts use bg-green-100 text-green-800 Tailwind classes
  const successMessage = page.locator('div.bg-green-100.text-green-800').first();
  await expect(successMessage).toBeVisible({ timeout: 10000 });
  await expect(successMessage).toContainText('Account successfully created');
}

/**
 * Verify successful login by checking URL and user presence
 */
export async function verifyLoginSuccess(page: Page, username: string): Promise<void> {
  await expect(page).toHaveURL(/\/(dashboard)?$/);
  await verifyUserLoggedIn(page, username);
}
