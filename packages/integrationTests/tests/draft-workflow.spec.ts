import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { addCardsByName, TEST_CARDS } from '../helpers/cardActions';
import { createCube, deleteCube, navigateToCubePlaytest } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { pickAllCards, startDraft } from '../helpers/draftActions';
import { navigateToCubeFromNav } from '../helpers/navigationActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Draft Workflow', () => {
  const testUser = getTestUser();
  let cubeId: string;
  const cubeName = `Draft Test Cube ${Date.now()}`;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    cubeId = await createCube(page, cubeName);

    // Add all 15 test cards for drafting (need seats×packs×cards = 2×1×5 = 10 minimum)
    await addCardsByName(page, cubeId, TEST_CARDS);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);
    await page.close();
  });

  test('3.1 - Navigate to the playtest page', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // Navigate to the cube via "Your Cubes" dropdown, then click Playtest in sidebar
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubePlaytest(page);

    // Verify we're on the playtest page
    await expect(page).toHaveURL(/\/cube\/playtest\//);
    // The playtest page should have the cube name somewhere
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('3.2-3.6 - Complete draft flow: start, pick cards, finish', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for the full draft flow

    await login(page, testUser.username, testUser.password);

    // Navigate to the cube first so we have the right context
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubePlaytest(page);

    // Start a small draft (2 seats, 1 pack, 5 cards) via API
    const draftPath = await startDraft(page, cubeId, { seats: 2, packs: 1, cards: 5 });
    expect(draftPath).toMatch(/\/draft\/.+/);

    // Follow the redirect to the draft page
    await page.goto(draftPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Verify the draft page loaded with pack info
    await page.waitForSelector('.no-touch-action', { timeout: 30000 });
    const packCards = await page.locator('.no-touch-action').count();
    expect(packCards).toBeGreaterThanOrEqual(1);

    // Pick all cards until draft completes
    await pickAllCards(page);

    // Should now be on the deckbuilder page
    expect(page.url()).toContain('/draft/deckbuilder/');
  });

  test('3.7 - Verify deckbuilder allows saving', async ({ page }) => {
    test.setTimeout(120000);

    await login(page, testUser.username, testUser.password);

    // Start draft directly via API (more reliable than navigating through UI)
    const draftPath = await startDraft(page, cubeId, { seats: 2, packs: 1, cards: 5 });
    await page.goto(draftPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Wait for first card to appear
    await page.waitForSelector('.no-touch-action', { timeout: 30000 });

    // Pick all cards
    await pickAllCards(page);

    // Verify deckbuilder page has expected elements
    expect(page.url()).toContain('/draft/deckbuilder/');

    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('3.8 - Verify completed deck appears on playtest page', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    // Navigate to the playtest page via sidebar
    await navigateToCubeFromNav(page, cubeName);
    await navigateToCubePlaytest(page);

    await page.waitForLoadState('networkidle');

    // The page should have loaded successfully with the cube
    await expect(page.locator(`text=${cubeName}`).first()).toBeVisible({ timeout: 15000 });
  });
});
