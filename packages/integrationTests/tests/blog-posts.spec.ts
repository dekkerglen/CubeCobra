import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { addCardsByName, TEST_CARDS } from '../helpers/cardActions';
import { createCube, deleteCube, navigateToCubeAbout } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { navigateToCubeFromNav } from '../helpers/navigationActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Blog Posts', () => {
  const testUser = getTestUser();
  let cubeId: string;
  const cubeName = `Blog Test Cube ${Date.now()}`;
  const blogTitle = `Test Blog Post ${Date.now()}`;
  const blogContent = 'This is a test blog post created by the integration test suite.';
  let blogPostId: string;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    cubeId = await createCube(page, cubeName);
    // Blog creation requires cardCount > 0
    await addCardsByName(page, cubeId, TEST_CARDS.slice(0, 3));
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);
    await page.close();
  });

  test('8.1 - Create a blog post on a cube', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // Create blog post via API
    const result = await page.evaluate(
      async ({ cubeId, title, markdown }) => {
        const resp = await fetch(`/cube/blog/post/${cubeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, markdown }),
          credentials: 'same-origin',
        });
        const data = await resp.json();
        return { ok: data.ok, redirect: data.redirect, status: resp.status };
      },
      { cubeId, title: blogTitle, markdown: blogContent },
    );

    expect(result.ok).toBeTruthy();
  });

  test('8.2 - Blog post appears on the cube blog page', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // Navigate to cube → About → Blog
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeAbout(page);

    // Click Blog sub-view in sidebar
    const blogLink = page.locator('a[href*="?view=blog"]').first();
    await blogLink.waitFor({ state: 'visible', timeout: 10000 });
    await blogLink.click();
    await page.waitForLoadState('domcontentloaded');

    // The blog post title should be visible
    await expect(page.getByText(blogTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test('8.3 - View a specific blog post', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // Navigate to cube → About → Blog
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeAbout(page);

    const blogLink = page.locator('a[href*="?view=blog"]').first();
    await blogLink.waitFor({ state: 'visible', timeout: 10000 });
    await blogLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Click on the blog post title to open it
    const postLink = page.getByText(blogTitle).first();
    await expect(postLink).toBeVisible({ timeout: 15000 });

    // Find the link wrapping the blog post title (it links to /cube/blog/blogpost/:id)
    const blogPostLink = page.locator(`a[href*="/cube/blog/blogpost/"]`).first();
    if (await blogPostLink.isVisible().catch(() => false)) {
      // Extract the blog post ID for later use
      const href = await blogPostLink.getAttribute('href');
      if (href) {
        const match = href.match(/\/cube\/blog\/blogpost\/([a-f0-9-]+)/);
        if (match) blogPostId = match[1];
      }
      await blogPostLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should show the blog post content
      await expect(page.getByText(blogTitle).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('8.4 - Delete a blog post', async ({ page }) => {
    test.skip(!blogPostId, 'Blog post ID not captured from previous test');

    await login(page, testUser.username, testUser.password);

    // Delete the blog post via direct navigation
    await page.goto(`/cube/blog/remove/${blogPostId}`, { waitUntil: 'domcontentloaded' });

    // After deletion, verify the blog post is gone from the blog page
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubeAbout(page);

    const blogLink = page.locator('a[href*="?view=blog"]').first();
    await blogLink.waitFor({ state: 'visible', timeout: 10000 });
    await blogLink.click();
    await page.waitForLoadState('domcontentloaded');

    // The deleted blog post title should no longer be visible
    // (There might still be auto-generated changelog posts)
    const postElement = page.getByText(blogTitle, { exact: true });
    await expect(postElement).toHaveCount(0, { timeout: 5000 });
  });
});
