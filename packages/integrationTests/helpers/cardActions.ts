import { Page } from '@playwright/test';

/**
 * Resolve a card name to its scryfall ID via the server API.
 */
export async function resolveCardName(page: Page, cardName: string): Promise<string> {
  const result = await page.evaluate(async (name: string) => {
    const resp = await fetch('/cube/api/getcardforcube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, defaultPrinting: 'recent' }),
      credentials: 'same-origin',
    });
    const data = await resp.json();
    return { scryfallId: data.card?.scryfall_id, status: resp.status };
  }, cardName);

  if (!result.scryfallId) {
    throw new Error(`Could not resolve card name "${cardName}"`);
  }
  return result.scryfallId;
}

/**
 * Add cards to a cube using the addtocube API.
 * Cards is an array of scryfall IDs.
 */
export async function addCardsToCube(
  page: Page,
  cubeId: string,
  scryfallIds: string[],
  board = 'mainboard',
): Promise<void> {
  const result = await page.evaluate(
    async ({ id, cards, boardName }) => {
      const resp = await fetch(`/cube/api/addtocube/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, board: boardName }),
        credentials: 'same-origin',
      });
      const data = await resp.json();
      return { success: data.success, status: resp.status, message: data.message };
    },
    { id: cubeId, cards: scryfallIds, boardName: board },
  );

  if (result.success !== 'true') {
    throw new Error(`Failed to add cards to cube ${cubeId}: ${result.message || 'unknown error'}`);
  }
}

/**
 * Add a single card by name to a cube.
 * Resolves the name to a scryfall ID first.
 */
export async function addCardByName(page: Page, cubeId: string, cardName: string, board = 'mainboard'): Promise<void> {
  const scryfallId = await resolveCardName(page, cardName);
  await addCardsToCube(page, cubeId, [scryfallId], board);
}

/**
 * Add multiple cards by name to a cube.
 */
export async function addCardsByName(
  page: Page,
  cubeId: string,
  cardNames: string[],
  board = 'mainboard',
): Promise<void> {
  const ids: string[] = [];
  for (const name of cardNames) {
    const id = await resolveCardName(page, name);
    ids.push(id);
  }
  await addCardsToCube(page, cubeId, ids, board);
}

/**
 * Well-known MTG cards for use in tests.
 */
export const TEST_CARDS = [
  'Lightning Bolt',
  'Counterspell',
  'Swords to Plowshares',
  'Dark Ritual',
  'Giant Growth',
  'Llanowar Elves',
  'Birds of Paradise',
  'Sol Ring',
  'Brainstorm',
  'Path to Exile',
  'Thoughtseize',
  'Fatal Push',
  'Mana Leak',
  'Doom Blade',
  'Rampant Growth',
];
