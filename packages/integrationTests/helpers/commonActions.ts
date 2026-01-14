import { Page } from '@playwright/test';

/**
 * Click a button with the specified text
 */
export async function clickButtonWithText(page: Page, buttonText: string): Promise<void> {
  const button = page.locator(`button:has-text("${buttonText}")`).first();
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click({ timeout: 10000 });
}
