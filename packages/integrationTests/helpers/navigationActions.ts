import { expect, Page } from '@playwright/test';

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
 * Navigate to the Explore page by clicking through the navbar dropdown.
 */
export async function navigateToExplore(page: Page): Promise<void> {
  await openNavDropdown(page, 'Explore');
  // Use href selector to avoid matching duplicate "Explore cubes" text elsewhere on page
  await page.locator('a[href="/explore"]').first().click();
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Navigate to the landing page.
 * This is the site root for guests — no nav link specifically goes here,
 * so we go to '/' which shows landing for non-logged-in users.
 */
export async function navigateToLanding(page: Page): Promise<void> {
  await page.goto('/landing', { waitUntil: 'domcontentloaded' });
}

/**
 * Navigate to the Search page, optionally with a search query.
 * Uses the navbar search bar when a query is provided,
 * or the Explore dropdown > "Search cubes" when no query.
 */
export async function navigateToSearch(page: Page, query?: string): Promise<void> {
  if (query) {
    // Use the search bar in the navbar header
    await ensurePageLoaded(page);
    const searchInput = page.locator('input[placeholder="Search cubes..."]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill(query);
    await searchInput.press('Enter');
  } else {
    // Navigate via the Explore dropdown
    await openNavDropdown(page, 'Explore');
    // Use href selector to avoid matching duplicate "Search cubes" text elsewhere on page
    await page.locator('a[href="/search"]').first().click();
  }
  await page.waitForLoadState('domcontentloaded');
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
 */
export async function navigateToCubeFromNav(page: Page, cubeName: string): Promise<void> {
  await ensurePageLoaded(page);
  await openNavDropdown(page, 'Your Cubes');
  // Click the cube name in the dropdown list
  await page.getByText(cubeName, { exact: true }).first().click();
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Search for cubes by typing in the search input on the search page
 */
export async function searchCubes(page: Page, query: string): Promise<void> {
  const searchInput = page.locator('input[placeholder*="Search cubes"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill(query);
  await searchInput.press('Enter');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Verify that a section with the given heading text exists on the page
 */
export async function verifySectionExists(page: Page, sectionText: string, timeout = 10000): Promise<void> {
  const section = page.locator(`text=${sectionText}`).first();
  await expect(section).toBeVisible({ timeout });
}
