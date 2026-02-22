import { expect, test } from '@playwright/test';

import { login } from '../helpers/authActions';
import { addCardsByName, TEST_CARDS } from '../helpers/cardActions';
import { createCube, deleteCube } from '../helpers/cubeActions';
import { dumpDomOnFailure } from '../helpers/domDump';
import { getTestUser } from '../helpers/testUser';

test.describe('Cube Export', () => {
  const testUser = getTestUser();
  let cubeId: string;
  const cubeName = `Export Test Cube ${Date.now()}`;

  test.afterEach(async ({ page }, testInfo) => {
    await dumpDomOnFailure(page, testInfo);
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    cubeId = await createCube(page, cubeName);
    await addCardsByName(page, cubeId, TEST_CARDS.slice(0, 5));
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, testUser.username, testUser.password);
    await deleteCube(page, cubeId);
    await page.close();
  });

  test('10.1 - Download cube as CSV', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/download/csv/${id}`, { credentials: 'same-origin' });
      const text = await resp.text();
      return {
        status: resp.status,
        contentType: resp.headers.get('content-type'),
        length: text.length,
        snippet: text.substring(0, 200),
      };
    }, cubeId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
    // CSV should contain a header row
    expect(response.snippet).toContain(',');
  });

  test('10.2 - Download cube as plaintext', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/download/plaintext/${id}`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length, snippet: text.substring(0, 200) };
    }, cubeId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
    // Should contain card names
    expect(response.snippet).toMatch(/Lightning Bolt|Counterspell|Swords to Plowshares/);
  });

  test('10.3 - Download cube in CubeCobra format', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/download/cubecobra/${id}`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length, snippet: text.substring(0, 200) };
    }, cubeId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });

  test('10.4 - Download cube for MTGO', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/download/mtgo/${id}`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, cubeId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });

  test('10.5 - Download cube for Forge', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/download/forge/${id}`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, cubeId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });

  test('10.6 - Download cube for XMage', async ({ page }) => {
    await login(page, testUser.username, testUser.password);

    const response = await page.evaluate(async (id: string) => {
      const resp = await fetch(`/cube/download/xmage/${id}`, { credentials: 'same-origin' });
      const text = await resp.text();
      return { status: resp.status, length: text.length };
    }, cubeId);

    expect(response.status).toBe(200);
    expect(response.length).toBeGreaterThan(0);
  });
});
