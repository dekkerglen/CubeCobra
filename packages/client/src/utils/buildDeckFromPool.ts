// Approximates a deck from a (validated) pool of card names by running the
// draft-bot ML deckbuilder — the same one the draft simulator uses. Returns the
// built mainboard as card names. Degrades gracefully (returns the pool) on any
// failure so a pool photo is never worse than no deck.

import { cardOracleId, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import { getCard } from './cards/getCard';
import { loadDraftBot, localBatchDeckbuild } from './draftBot';

type CsrfFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export async function buildDeckFromPool(csrfFetch: CsrfFetch, cube: Cube, poolNames: string[]): Promise<string[]> {
  try {
    // Names → cards → oracle ids (the deckbuilder works in oracle space).
    const resolved = await Promise.all(poolNames.map((name) => getCard(csrfFetch, cube.defaultPrinting, name)));
    const cards = resolved.filter((card): card is CardDetails => card !== null);
    const oracleToName = new Map<string, string>();
    const pool: string[] = [];
    for (const card of cards) {
      const oracle = cardOracleId(detailsToCard(card));
      oracleToName.set(oracle, card.name);
      pool.push(oracle);
    }
    if (pool.length === 0) {
      return poolNames;
    }

    await loadDraftBot();

    // cardMeta + basics for the cube (formatId defaults to -1 = standard draft).
    const res = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cube.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numDrafts: 1, numSeats: 1 }),
    });
    const setup = await res.json();
    if (!setup?.success || !setup.cardMeta) {
      return poolNames;
    }

    const [result] = await localBatchDeckbuild([{ pool, cardMeta: setup.cardMeta, basics: setup.basics ?? [] }]);
    const mainboard = result?.mainboard ?? [];
    if (mainboard.length === 0) {
      return poolNames;
    }

    const basicName = (oracle: string): string | undefined =>
      (setup.basics ?? []).find((b: { oracleId: string; name?: string }) => b.oracleId === oracle)?.name;
    return mainboard.map((oracle) => setup.cardMeta[oracle]?.name ?? basicName(oracle) ?? oracleToName.get(oracle) ?? oracle);
  } catch {
    return poolNames;
  }
}
