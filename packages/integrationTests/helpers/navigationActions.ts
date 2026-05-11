import { Page } from '@playwright/test';

/**
 * Navigate to the site homepage (entry point).
 * For logged-in users this redirects to /dashboard, for guests to /landing.
 */
export async function navigateToHomepage(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

/**
 * Ensure the page has a loaded navbar (not on about:blank).
 * If page hasn't navigated yet, go to homepage first.
 */
async function ensurePageLoaded(page: Page): Promise<void> {
  if (page.url() === 'about:blank') {
    await navigateToHomepage(page);
  }
}

/**
 * Open a navbar dropdown menu by clicking its trigger text.
 * NavMenu dropdowns open on click.
 */
async function openNavDropdown(page: Page, menuLabel: string): Promise<void> {
  await ensurePageLoaded(page);
  // NavMenu renders the label text inside a div with cursor-pointer.
  // On desktop (viewport >= 1024px / lg) the text label is visible.
  const trigger = page.getByText(menuLabel, { exact: true }).first();
  await trigger.click();
}

/**
 * Navigate to Dashboard by clicking the site logo in the navbar.
 * For logged-in users, '/' redirects to /dashboard.
 * There are multiple logo links (mobile + desktop); click the first visible one.
 */
export async function navigateToDashboard(page: Page): Promise<void> {
  await ensurePageLoaded(page);
  // There are two a[href="/"] elements (mobile sticker + desktop banner).
  // Click whichever is visible at the current viewport.
  const logos = page.locator('a[href="/"]');
  const count = await logos.count();
  for (let i = 0; i < count; i++) {
    if (await logos.nth(i).isVisible()) {
      await logos.nth(i).click();
      await page.waitForLoadState('domcontentloaded');
      return;
    }
  }
  // Fallback: none visible (shouldn't happen), navigate directly
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

/**
 * Navigate to a specific cube from the "Your Cubes" navbar dropdown.
 * Requires the user to be logged in and the cube to exist.
 *
 * NOTE: The cube name may also appear on the dashboard tiles, so we scope
 * the search to the NavMenu dropdown panel (`.shadow-lg a`) to avoid
 * clicking the wrong element. We then navigate via `page.goto()` to
 * avoid ad overlays intercepting pointer events.
 */
export async function navigateToCubeFromNav(page: Page, cubeName: string): Promise<void> {
  await ensurePageLoaded(page);
  await openNavDropdown(page, 'Your Cubes');

  // Scope to the opened dropdown panel (NavMenu renders inside a div.shadow-lg).
  // This avoids matching cube name text on the dashboard tiles.
  const cubeLink = page.locator('div.shadow-lg a[href*="/cube/list/"]').filter({ hasText: cubeName }).first();
  await cubeLink.waitFor({ state: 'visible', timeout: 10000 });

  // Use direct navigation to avoid ad/donation overlays intercepting clicks.
  const href = await cubeLink.getAttribute('href');
  if (href) {
    await page.goto(href, { waitUntil: 'domcontentloaded' });
  } else {
    await cubeLink.click({ force: true });
    await page.waitForLoadState('domcontentloaded');
  }
}
