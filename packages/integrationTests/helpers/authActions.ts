import { expect, Page } from '@playwright/test';

import { TestUser } from './testUser';

/**
 * Navigate to the login page and wait for it to load
 */
export async function navigateToLogin(page: Page): Promise<void> {
  await page.goto('/user/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[id="username"]', { state: 'visible' });
}

/**
 * Navigate to the register page and wait for it to load
 */
export async function navigateToRegister(page: Page): Promise<void> {
  await page.goto('/user/register', { waitUntil: 'networkidle' });
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
}

/**
 * Submit a form and wait for navigation to complete
 */
export async function submitFormAndWaitForNavigation(page: Page, timeout: number = 15000): Promise<void> {
  await Promise.all([
    page.waitForNavigation({ timeout }),
    page
      .locator('form')
      .first()
      .evaluate((form: HTMLFormElement) => form.submit()),
  ]);
}

/**
 * Complete login flow: navigate, fill form, and submit
 */
export async function login(page: Page, username: string, password: string): Promise<void> {
  await navigateToLogin(page);
  await fillLoginForm(page, username, password);
  await page.waitForTimeout(1000); // Wait 1 second before submitting
  await submitFormAndWaitForNavigation(page);
}

/**
 * Complete registration flow: navigate, fill form, and submit
 */
export async function register(page: Page, user: TestUser): Promise<void> {
  await navigateToRegister(page);
  await fillRegistrationForm(page, user);
  await submitFormAndWaitForNavigation(page);
}

/**
 * Verify user is logged in by checking for their username in the UI
 */
export async function verifyUserLoggedIn(page: Page, username: string, timeout: number = 10000): Promise<void> {
  const userMenu = page.locator('text=' + username).first();
  await expect(userMenu).toBeVisible({ timeout });
}

/**
 * Verify successful registration by checking for success message
 */
export async function verifyRegistrationSuccess(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/user\/login/);
  const successMessage = page.locator('.alert-success, .flash-success');
  await expect(successMessage).toBeVisible();
}

/**
 * Verify successful login by checking URL and user presence
 */
export async function verifyLoginSuccess(page: Page, username: string): Promise<void> {
  await expect(page).toHaveURL(/\/(dashboard)?$/);
  await verifyUserLoggedIn(page, username);
}
