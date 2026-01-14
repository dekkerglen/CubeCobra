import { expect, test } from '@playwright/test';

import { getTestUser } from '../helpers/testUser';

test.describe('Authentication', () => {
  const testUser = getTestUser();

  test('should register a new account', async ({ page }) => {
    await page.goto('/user/register');

    // Fill in the registration form
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill('input[name="password2"]', testUser.password);

    // Check if there's a challenge question (math question for bot prevention)
    const challengeInput = page.locator('input[name="answer"]');
    if (await challengeInput.isVisible()) {
      // Get the challenge question text
      const questionText = await page.locator('label[for="challenge-answer"]').textContent();

      if (questionText) {
        // Extract and solve the math equation (e.g., "What is 5 + 3?")
        const match = questionText.match(/What is (\d+) ([+\-*]) (\d+)\?/);
        if (match) {
          const num1 = parseInt(match[1]);
          const operator = match[2];
          const num2 = parseInt(match[3]);

          let answer: number;
          switch (operator) {
            case '+':
              answer = num1 + num2;
              break;
            case '-':
              answer = num1 - num2;
              break;
            case '*':
              answer = num1 * num2;
              break;
            default:
              throw new Error(`Unknown operator: ${operator}`);
          }

          await challengeInput.fill(answer.toString());
        }
      }
    }

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for navigation to login page
    await page.waitForURL(/\/user\/login/);

    // Verify success message (account created)
    const successMessage = page.locator('.alert-success, .flash-success');
    await expect(successMessage).toBeVisible();
  });

  test('should login with the newly created account', async ({ page }) => {
    await page.goto('/user/login');

    // Fill in login form
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="password"]', testUser.password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for redirect to home page
    await page.waitForURL('/');

    // Verify user is logged in by checking for user menu or profile link
    const userMenu = page.locator('text=' + testUser.username).first();
    await expect(userMenu).toBeVisible({ timeout: 10000 });
  });

  test('should maintain login session across page navigation', async ({ page }) => {
    // First login
    await page.goto('/user/login');
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Navigate to different pages and verify session is maintained
    await page.goto('/explore');
    const userMenuOnExplore = page.locator('text=' + testUser.username).first();
    await expect(userMenuOnExplore).toBeVisible({ timeout: 5000 });

    // Navigate to account page
    await page.goto('/user/account');
    await expect(page).toHaveURL(/\/user\/account/);

    // Verify we can access authenticated routes
    const accountContent = page.locator('text=/Profile|Account/i').first();
    await expect(accountContent).toBeVisible();
  });
});
