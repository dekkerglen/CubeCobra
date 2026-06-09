// Approximates decks from validated card pools by running the draft-bot ML
// deckbuilder — the same batched path the draft simulator uses at end-of-draft.
// Every pool is built in ONE model load + ONE cube setup + ONE batched forward
// pass (the deck_build_decoder/draft_decoder natively support batches), instead
// of looping the heavy model once per player. Each pool yields a built mainboard
// (incl. basics) plus the leftover cards as a sideboard. Degrades gracefully:
// any pool we can't build is simply omitted, so the caller falls back to the raw
// pool and a photo is never worse than no deck.

import { isManaFixingLand } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import { BasicLandInfo } from '@utils/datatypes/SimulationReport';

import { DeckbuildEntry, loadDraftBot, localBatchDeckbuild } from './draftBot';

type CsrfFetch = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

export interface PoolToBuild {
  key: number; // caller's identifier for this pool (e.g. player index)
  oracles: string[]; // the pool, as oracle ids
}

export interface BuiltPoolDeck {
  mainboard: string[]; // oracle ids of the built deck (includes basic lands)
  sideboard: string[]; // oracle ids of the cards left out of the deck
}

export interface BuildDecksCallbacks {
  // Draft-model download progress, 0–100 (the dominant cost on a cold load).
  onModelProgress?: (pct: number) => void;
  // Fired once the model is loaded and the batched deckbuild is about to run.
  onBuildStart?: () => void;
}

export async function buildDecksFromPools(
  csrfFetch: CsrfFetch,
  cube: Cube,
  pools: PoolToBuild[],
  // Card details for every card across all pools, used to guarantee the
  // deckbuilder has metadata (type/colours) for cards that didn't surface in the
  // sampled packs returned by the setup endpoint.
  poolCardDetails: CardDetails[],
  callbacks?: BuildDecksCallbacks,
): Promise<Map<number, BuiltPoolDeck>> {
  const result = new Map<number, BuiltPoolDeck>();
  const buildable = pools.filter((pool) => pool.oracles.length > 0);
  if (buildable.length === 0) {
    return result;
  }

  try {
    await loadDraftBot(callbacks?.onModelProgress);

    // One cube setup (cardMeta + basics) shared by every pool. numSeats must be
    // >= 2 to satisfy the endpoint's validation — the old per-player path sent
    // numSeats:1, which silently failed validation and fell back to the raw pool
    // (so "built" decks were really the entire pool). formatId defaults to -1.
    const res = await csrfFetch(`/cube/api/simulatesetup/${encodeURIComponent(cube.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numDrafts: 1, numSeats: 8 }),
    });
    const setup = await res.json();
    if (!setup?.success || !setup.cardMeta) {
      return result;
    }

    // Ensure every pool card has metadata for land/colour detection, even if it
    // didn't appear in the sampled packs.
    const cardMeta: DeckbuildEntry['cardMeta'] = { ...setup.cardMeta };
    for (const details of poolCardDetails) {
      const oracle = details.oracle_id;
      if (!oracle || cardMeta[oracle]) {
        continue;
      }
      cardMeta[oracle] = {
        name: details.name,
        type: details.type ?? '',
        colorIdentity: details.color_identity ?? [],
        parsedCost: details.parsed_cost ?? [],
        producedMana: details.produced_mana ?? [],
        isManaFixingLand: isManaFixingLand(details) || undefined,
      };
    }
    const basics: BasicLandInfo[] = setup.basics ?? [];

    callbacks?.onBuildStart?.();
    const entries: DeckbuildEntry[] = buildable.map((pool) => ({ pool: pool.oracles, cardMeta, basics }));
    const built = await localBatchDeckbuild(entries);

    buildable.forEach((pool, index) => {
      const deck = built[index];
      if (deck && deck.mainboard.length > 0) {
        result.set(pool.key, { mainboard: deck.mainboard, sideboard: deck.sideboard });
      }
    });
  } catch {
    // Leave any unbuilt pools out — the caller treats a missing entry as "use the
    // raw pool", so a transient ML/setup failure never blocks the upload.
  }

  return result;
}
