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

/**
 * Pick a single card from the draft pack using manual mouse events.
 *
 * The draft page uses @dnd-kit/core with PointerSensor. A fast `.click()` fires
 * pointerdown/pointerup before React renders and dnd-kit computes collision
 * detection, leaving `over` as null and causing the handler to silently return.
 *
 * To work around this, we manually sequence mouse events with a short delay
 * between down and up so dnd-kit has time to compute the `over` target.
 * A small mouse move triggers the collision detection update.
 * The drag completes in < 200ms so dnd-kit treats it as a "click" pick.
 */
async function clickPackCard(page: Page): Promise<void> {
  const packCard = page.locator('.no-touch-action').first();
  const box = await packCard.boundingBox();
  if (!box) {
    throw new Error('Pack card not visible — cannot get bounding box');
  }

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  // Allow React to process drag start and dnd-kit to initialise
  await page.waitForTimeout(50);
  // Small move triggers pointermove → collision detection update
  await page.mouse.move(x + 1, y + 1);
  await page.waitForTimeout(50);
  await page.mouse.up();
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
    const packCard = page.locator('.no-touch-action').first();
    try {
      await packCard.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // No more cards — draft may be finishing, wait for redirect
      await page.waitForURL('**/draft/deckbuilder/**', { timeout: 30000 });
      return;
    }

    // Pick the card using manual mouse events for dnd-kit compatibility
    await clickPackCard(page);

    // Wait for the pick to process (predictions + bot picks + UI update)
    await page.waitForTimeout(pickDelayMs);
  }

  // Final wait for deckbuilder redirect
  await page.waitForURL('**/draft/deckbuilder/**', { timeout: 30000 });
}
