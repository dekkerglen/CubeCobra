import { Page } from '@playwright/test';

/**
 * Click a button with the specified text and wait for navigation to complete
 */
export async function clickButtonWithText(page: Page, buttonText: string, timeout: number = 15000): Promise<void> {
  const button = page.locator(`button:has-text("${buttonText}")`).first();
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click();
  await page.waitForLoadState('networkidle', { timeout });
}
