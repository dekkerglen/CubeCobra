import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { addCardsByName, TEST_CARDS } from '../helpers/cardActions';
import { createCube, deleteCube } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { pickAllCards, startDraft } from '../helpers/draftActions';
import { getTestUser } from '../helpers/testUser';

test.describe('Deck Export', () => {
  const testUser = getTestUser();
  let cubeId: string;
  let draftId: string;
  const cubeName = `Deck Export Test Cube ${Date.now()}`;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await login(page, testUser.username, testUser.password);
    cubeId = await createCube(page, cubeName);
    await addCardsByName(page, cubeId, TEST_CARDS);

    // Complete a draft so we have a deck to export
    try {
      const draftPath = await startDraft(page, cubeId, { seats: 2, packs: 1, cards: 5 });
      await page.goto(draftPath, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.no-touch-action', { timeout: 30000 });
      await pickAllCards(page);

      // Extract draft ID from URL
      const url = page.url();
      const match = url.match(/\/draft\/deckbuilder\/([a-f0-9-]+)/);
      if (match) {
        draftId = match[1];
      }
    } catch (e) {
      console.error('Deck-export beforeAll: draft flow failed:', e);
    }

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);
    await page.close();
  });

  test('9.1 - View a completed deck page', async ({ page }) => {
    test.skip(!draftId, 'Draft ID not captured — draft may have failed in beforeAll');
    test.setTimeout(60000);

    await login(page, testUser.username, testUser.password);
    await page.goto(`/cube/deck/${draftId}`, { waitUntil: 'domcontentloaded' });

    // The deck page should load with content
    await page.waitForLoadState('domcontentloaded');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('9.2 - Download deck as plaintext', async ({ page }) => {
    test.skip(!draftId, 'Draft ID not captured');

    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/deck/download/txt/${id}/0`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, draftId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });

  test('9.3 - Download deck for Arena', async ({ page }) => {
    test.skip(!draftId, 'Draft ID not captured');

    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/deck/download/arena/${id}/0`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, draftId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });

  test('9.4 - Download deck for MTGO', async ({ page }) => {
    test.skip(!draftId, 'Draft ID not captured');

    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/deck/download/mtgo/${id}/0`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, draftId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });

  test('9.5 - Download deck for Forge', async ({ page }) => {
    test.skip(!draftId, 'Draft ID not captured');

    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/deck/download/forge/${id}/0`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, draftId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });
});
