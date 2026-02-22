import { expect, Page } from '@playwright/test';

/**
 * Create a cube by directly POSTing to /cube/add.
 * CSRF is effectively disabled (token is always '').
 * ENABLE_BOT_SECURITY=false bypasses captcha/challenge on the server.
 * The page must already be logged in (has session cookies).
 *
 * Note: This is kept as an API call since it's a CRUD operation, not navigation.
 * After creation, the page lands on the new cube's list page.
 */
export async function createCube(page: Page, cubeName: string): Promise<string> {
  // POST directly to /cube/add using page.evaluate (shares the session cookies)
  const result = await page.evaluate(async (name: string) => {
    const formData = new URLSearchParams();
    formData.append('_csrf', '');
    formData.append('nickname', 'Your Nickname');
    formData.append('name', name);

    const resp = await fetch('/cube/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      redirect: 'follow',
      credentials: 'same-origin',
    });
    return { url: resp.url, status: resp.status };
  }, cubeName);

  // The server redirects to /cube/view/{id} which redirects to /cube/list/{id}
  if (result.url && result.url.includes('/cube/')) {
    await page.goto(result.url, { waitUntil: 'domcontentloaded' });
  }

  // Extract cube ID from the final URL
  const url = page.url();
  const cubeIdMatch = url.match(/\/cube\/(?:list|view|overview|about)\/([a-f0-9-]+)/);
  if (cubeIdMatch) {
    return cubeIdMatch[1];
  }

  throw new Error(`Failed to create cube. Fetch URL: ${result.url}, Current URL: ${url}`);
}

/**
 * Navigate to a cube section using the sidebar links.
 * Must already be on a cube page (sidebar is present).
 * Uses href pattern matching which works for both collapsed and expanded sidebar.
 *
 * NOTE: Ad/donation overlays (bg-advert) can intercept pointer events on cube pages.
 * We use JS-based navigation as a fallback when clicks are intercepted.
 */
async function clickCubeSidebarLink(page: Page, section: string): Promise<void> {
  // Sidebar links have href="/cube/{section}/{cubeId}" (without query params for the main link).
  const link = page.locator(`a[href*="/cube/${section}/"]`).first();
  await link.waitFor({ state: 'visible', timeout: 10000 });

  // Get the href and navigate directly via JS to avoid ad overlays intercepting clicks
  const href = await link.getAttribute('href');
  if (href) {
    await page.goto(href, { waitUntil: 'domcontentloaded' });
  } else {
    // Fallback to force click
    await link.click({ force: true, timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * Navigate to a cube's list page using the sidebar.
 * Must already be on a cube page.
 */
export async function navigateToCubeList(page: Page, _cubeId?: string): Promise<void> {
  await clickCubeSidebarLink(page, 'list');
}

/**
 * Navigate to a cube's about page using the sidebar.
 * Must already be on a cube page.
 */
export async function navigateToCubeAbout(page: Page): Promise<void> {
  await clickCubeSidebarLink(page, 'about');
}

/**
 * Navigate to a cube's playtest page using the sidebar.
 * Must already be on a cube page.
 */
export async function navigateToCubePlaytest(page: Page): Promise<void> {
  await clickCubeSidebarLink(page, 'playtest');
}

/**
 * Navigate to a cube's settings page using the sidebar.
 * Must already be on a cube page.
 */
export async function navigateToCubeSettings(page: Page): Promise<void> {
  await clickCubeSidebarLink(page, 'settings');
}

/**
 * Delete a cube via direct POST.
 *
 * Note: Kept as API call since it's a destructive CRUD operation.
 */
export async function deleteCube(page: Page, cubeId: string): Promise<void> {
  await page.evaluate(async (id: string) => {
    const formData = new URLSearchParams();
    formData.append('_csrf', '');
    formData.append('nickname', 'Your Nickname');

    await fetch(`/cube/remove/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      redirect: 'follow',
      credentials: 'same-origin',
    });
  }, cubeId);
}

/**
 * Verify a cube exists by checking for its name on the current page.
 */
export async function verifyCubeExists(page: Page, cubeName: string): Promise<void> {
  await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 10000 });
}
