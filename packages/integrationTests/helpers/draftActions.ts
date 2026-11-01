import { Page } from '@playwright/test';

/**
 * Start a draft for a cube via the API.
 * Returns the draft page URL path (e.g., /draft/<id>).
 */
export async function startDraft(
  page: Page,
  cubeId: string,
  options: { seats?: number; packs?: number; cards?: number } = {},
): Promise<string> {
  const { seats = 2, packs = 1, cards = 5 } = options;

  const result = await page.evaluate(
    async ({ id, s, p, c }) => {
      const resp = await fetch(`/draft/start/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          seats: String(s),
          packs: String(p),
          cards: String(c),
        }),
        credentials: 'same-origin',
        redirect: 'follow',
      });
      return { url: resp.url, status: resp.status, ok: resp.ok };
    },
    { id: cubeId, s: seats, p: packs, c: cards },
  );

  if (!result.ok) {
    throw new Error(`Failed to start draft: status ${result.status}`);
  }

  // Extract path from the full URL
  const url = new URL(result.url);
  return url.pathname;
}

/** Cards in the pack being drafted from (the draft table tags each card with its zone). */
export const PACK_CARD = '[data-zone="pack"]';

/**
 * Pick a single card from the draft pack. With a mouse, a press without a drag
 * drafts the card. The click waits out the pack-opening overlay and cards of a
 * passed pack still sliding off, which don't take pointer events.
 */
async function clickPackCard(page: Page): Promise<void> {
  await page.locator(PACK_CARD).first().click({ timeout: 15000 });
}

/**
 * Pick all cards in the draft by clicking pack cards until the draft finishes.
 * Waits for redirect to deckbuilder page.
 */
export async function pickAllCards(page: Page, maxPicks = 20, pickDelayMs = 3000): Promise<void> {
  for (let i = 0; i < maxPicks; i++) {
    // Check if we've been redirected to deckbuilder
    if (page.url().includes('/draft/deckbuilder/')) {
      return;
    }

    // The page might show a "Waiting for Bot Picks..." spinner while
    // predictions are loading. Wait for it to disappear first.
    const spinner = page.getByText('Waiting for Bot Picks...');
    try {
      // If the spinner is visible, wait for it to disappear
      if (await spinner.isVisible().catch(() => false)) {
        await spinner.waitFor({ state: 'hidden', timeout: 30000 });
      }
    } catch {
      // spinner never appeared or timed out — continue anyway
    }

    // Check for prediction failure and retry if needed
    const retryButton = page.getByText('Bot picks failed. Try again?');
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
      await page.waitForTimeout(5000);
      continue; // Re-loop to wait for spinner / retry
    }

    // Re-check for deckbuilder redirect after waiting
    if (page.url().includes('/draft/deckbuilder/')) {
      return;
    }

    // Wait for a pickable card to appear
    const packCard = page.locator(PACK_CARD).first();
    try {
      await packCard.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // No more cards — draft may be finishing, wait for redirect
      await page.waitForURL('**/draft/deckbuilder/**', { timeout: 30000 });
      return;
    }

    await clickPackCard(page);

    // Wait for the pick to process (predictions + bot picks + UI update)
    await page.waitForTimeout(pickDelayMs);
  }

  // Final wait for deckbuilder redirect
  await page.waitForURL('**/draft/deckbuilder/**', { timeout: 30000 });
}
