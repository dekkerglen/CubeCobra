import { type DeckbuildEntry, type DeckbuildMlFns, runBatchDeckbuild } from '@utils/drafting/deckbuildCore';
import { runManabaseTrim } from '@utils/drafting/landTrim';
import { type BasicCardLike, pickAddedBasics } from '@utils/drafting/manabaseHeuristics';

import { buildLandMetaLookup } from './buildLandMetaLookup';
import carddb, { cardFromId, getOracleForMl, getReasonableCardByOracle } from './carddb';
import { computeDeckbuildFacts } from './deckbuildFacts';
import { batchBuildOrThrow, batchDraftOrThrow, buildOrThrow, draft as draftbotPick, draftOrThrow } from './ml';

// Bot deckbuilding leans on the ML service for every pick. A transient 5xx /
// timeout must not be read as "no more cards" — that silently truncates the
// deck. Retry instead, but bounded:
//   - small attempt cap so a wedged ML service fails fast and the caller can
//     surface a real error (or fall back to a naive layout)
//   - exponential backoff with jitter so retries don't pile onto the same
//     overloaded recommender connection in lockstep
//   - overall time budget so a single ML call can't hold an HTTP request open
//     past ELB/client timeouts (which previously produced ERR_HTTP_HEADERS_SENT
//     when the eventual 200 raced with the closed socket)
const ML_MAX_ATTEMPTS = 3;
const ML_RETRY_BASE_MS = 150;
const ML_RETRY_MAX_DELAY_MS = 1_000;
const ML_RETRY_BUDGET_MS = 8_000;

async function withMlRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + ML_RETRY_BUDGET_MS;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= ML_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= ML_MAX_ATTEMPTS) break;

      // Exponential backoff with jitter, clamped, then clamped again against
      // the overall budget so we never sleep past the deadline.
      const exp = Math.min(ML_RETRY_MAX_DELAY_MS, ML_RETRY_BASE_MS * 2 ** (attempt - 1));
      const jittered = Math.floor(Math.random() * exp);
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const delay = Math.min(jittered, remaining);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(
    `${label} failed after ${ML_MAX_ATTEMPTS} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

/*
  drafterState = {
    cardsInPack: [oracle_id]
    picked: [oracle_id],
    pickNum: number, // 0-Indexed pick number from this pack (so this will be the 5th card they've picked since opening the first pack of the draft).
    numPicks: number, // How many cards were in the pack when it was opened.
    packNum: number, // 0-Indexed pack number
    numPacks: number, // How many packs will this player open
  };
  */

const calculateBasics = (mainboard: any[], basics: any[], deckSize: number = 40): any[] => {
  const cardMeta = buildLandMetaLookup(
    mainboard.map((card: any) => card.oracle_id),
    basics,
  );
  // Map each mainboard card to a stable lookup key and ensure it has color metadata.
  // The card database (via buildLandMetaLookup) is authoritative when the card
  // resolves there; otherwise fall back to the card object's own fields so cards
  // without an oracle id / not in the database still drive the color demand.
  const mainboardKeys = mainboard.map((card: any, index: number) => {
    const key = card.oracle_id ?? `__mainboard_${index}`;
    if (!cardMeta[key]) {
      cardMeta[key] = {
        name: card.name ?? key,
        type: card.type ?? '',
        colorIdentity: card.color_identity ?? [],
        producedMana: card.produced_mana ?? [],
      };
    }
    return key;
  });
  const basicCards: Array<BasicCardLike & { card: any }> = basics.map((card: any) => ({
    card,
    oracleId: card.oracle_id,
    type: card.type ?? '',
    colorIdentity: card.color_identity ?? [],
    producedMana: card.produced_mana ?? [],
  }));
  return pickAddedBasics(mainboardKeys, cardMeta, basicCards, deckSize).map((basic) => basic.card);
};

export const deckbuild = async (
  pool: any[],
  basics: any[],
  maxSpells: number = 23,
  maxLands: number = 17,
): Promise<{ mainboard: string[]; sideboard: string[] }> => {
  const poolOracles = pool.map((card: any) => card.oracle_id);
  const deckSize = maxSpells + maxLands;

  // Helper: check if an oracle is a land
  const oracleIsLand = (oracle: string): boolean => {
    const oracleIds = carddb.oracleToId[oracle];
    return !!(oracleIds && oracleIds[0] && cardFromId(oracleIds[0]).type.includes('Land'));
  };

  // Conspiracy / Vanguard cards affect the draft but should not be selected
  // for a constructed mainboard; they remain in the sideboard.
  const oracleIsConspiracyOrVanguard = (oracle: string): boolean => {
    const oracleIds = carddb.oracleToId[oracle];
    if (!oracleIds || !oracleIds[0]) return false;
    const type = cardFromId(oracleIds[0]).type || '';
    return type.includes('Conspiracy') || type.includes('Vanguard');
  };

  // Build ML substitution maps: original oracle <-> ML oracle
  // Multiple originals can map to the same ML oracle
  const toMl: Record<string, string> = {};
  const fromMl: Record<string, string[]> = {};
  for (const oracle of poolOracles) {
    if (toMl[oracle] !== undefined) continue;
    const mlOracle = getOracleForMl(oracle, null);
    toMl[oracle] = mlOracle;
    if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
    if (!fromMl[mlOracle].includes(oracle)) fromMl[mlOracle].push(oracle);
  }

  const poolMlOracles = poolOracles.map((o) => toMl[o] ?? o);

  // Phase 1: Use deckbuild model to seed the first 10 cards
  const buildResult = await withMlRetry('deckbuild seed', () => buildOrThrow(poolMlOracles));

  const mainboard: string[] = [];
  const remainingPool = [...poolOracles]; // tracks available copies (original oracles)
  let spellCount = 0;
  let landCount = 0;

  // Count copies in pool per oracle for duplicate tracking
  const poolCopies: Record<string, number> = {};
  for (const oracle of poolOracles) {
    poolCopies[oracle] = (poolCopies[oracle] ?? 0) + 1;
  }
  const deckCopies: Record<string, number> = {};

  // Seed from build model — take up to 10 cards respecting limits
  for (const item of buildResult) {
    if (mainboard.length >= 10) break;

    const mlOracle = item.oracle;
    // Map back to original oracle(s) - find one that's still in the remaining pool
    const originals = fromMl[mlOracle] ?? [mlOracle];
    const oracle = originals.find((o) => remainingPool.includes(o));
    if (!oracle) continue;

    if (oracleIsConspiracyOrVanguard(oracle)) continue;

    const land = oracleIsLand(oracle);

    if (land && landCount >= maxLands) continue;
    if (!land && spellCount >= maxSpells) continue;

    // Check we actually have a copy in the remaining pool
    const poolIdx = remainingPool.indexOf(oracle);
    if (poolIdx === -1) continue;

    // Apply duplicate penalty — 10% per existing copy
    const existing = deckCopies[oracle] ?? 0;
    const adjustedRating = item.rating * Math.pow(0.9, existing);
    if (adjustedRating <= 0) continue;

    mainboard.push(oracle);
    deckCopies[oracle] = existing + 1;
    remainingPool.splice(poolIdx, 1);

    if (land) landCount += 1;
    else spellCount += 1;
  }

  // Phase 2: Use draft model to pick from remaining pool one at a time
  while (mainboard.length < deckSize && remainingPool.length > 0) {
    // Filter remaining pool to only cards that fit under the limits
    const candidates = remainingPool.filter((oracle) => {
      if (oracleIsConspiracyOrVanguard(oracle)) return false;
      const land = oracleIsLand(oracle);
      if (land && landCount >= maxLands) return false;
      if (!land && spellCount >= maxSpells) return false;
      return true;
    });

    if (candidates.length === 0) break;

    // Deduplicate ML oracles for the draft call
    const uniqueMlCandidates = [...new Set(candidates.map((o) => toMl[o] ?? o))];
    const mlMainboard = mainboard.map((o) => toMl[o] ?? o);

    const draftResult = await withMlRetry('deckbuild pick', () => draftOrThrow(uniqueMlCandidates, mlMainboard));

    // Apply duplicate penalty and pick the best, mapping back to originals
    let bestOracle: string | null = null;
    let bestScore = -Infinity;

    for (const item of draftResult) {
      const mlOracle = item.oracle;
      const originals = fromMl[mlOracle] ?? [mlOracle];
      // Find an original that's still a candidate
      const oracle = originals.find((o) => candidates.includes(o));
      if (!oracle) continue;

      const existing = deckCopies[oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (adjustedRating > bestScore) {
        bestScore = adjustedRating;
        bestOracle = oracle;
      }
    }

    if (!bestOracle || bestScore <= 0) break;

    // Remove one copy from remaining pool
    const poolIdx = remainingPool.indexOf(bestOracle);
    if (poolIdx === -1) break;

    mainboard.push(bestOracle);
    deckCopies[bestOracle] = (deckCopies[bestOracle] ?? 0) + 1;
    remainingPool.splice(poolIdx, 1);

    const land = oracleIsLand(bestOracle);
    if (land) landCount += 1;
    else spellCount += 1;
  }

  // Manabase trim — same heuristic + batched ML rerank path as batchDeckbuild, just one
  // deck wide. Cut lands are pushed back into remainingPool to land in the sideboard.
  try {
    await runManabaseTrim(
      [
        {
          mainboard,
          sideboard: remainingPool,
          basics: basics
            .filter((b: any) => b?.oracle_id)
            .map((b: any) => ({ oracleId: b.oracle_id, colorIdentity: b.color_identity ?? [] })),
          deckSize,
          maxLands,
          cardMeta: buildLandMetaLookup(mainboard, basics),
          originalPool: [...mainboard, ...remainingPool],
        },
      ],
      (inputs) => withMlRetry('deckbuild (trim rerank)', () => batchDraftOrThrow(inputs)),
    );
  } catch (err) {
    // Ship the partially-trimmed deck rather than failing the build, but record the
    // failure so a wedged rerank service is visible in logs.
    console.warn('deckbuild manabase trim failed; shipping partial trim', err);
  }

  // Fill remaining slots with basics
  mainboard.push(
    ...calculateBasics(mainboard.map(getReasonableCardByOracle), basics, deckSize).map((card) => card.oracle_id),
  );

  // Everything left in the pool is sideboard
  const sideboard = remainingPool.slice().sort();

  return {
    mainboard: mainboard.sort(),
    sideboard,
  };
};

/**
 * Build a minimal LandMeta lookup for the oracles in a mainboard plus the cube's basics so
 * the shared manabase heuristics can query types, color identity, produced mana, and the
 * "is this a fixer/fetch?" flag without re-touching the carddb on every check.
 */
/**
 * Build multiple bot decks in one batched pass.
 *
 * Thin wrapper over the carddb-free core (@utils/drafting/deckbuildCore): compute the
 * carddb-derived facts for every oracle in the pools + basics, then run the shared algorithm
 * with the ML calls wired to the recommender (retried). The bot-deckbuild lambda runs the
 * exact same core with facts shipped in its job payload, so the sync and async paths stay in
 * lockstep — keep behaviour changes in the core, not here.
 */
export const batchDeckbuild = async (
  entries: { pool: any[]; basics: any[]; maxSpells?: number; maxLands?: number }[],
): Promise<{ mainboard: string[]; sideboard: string[] }[]> => {
  if (entries.length === 0) return [];

  const coreEntries: DeckbuildEntry[] = entries.map((entry) => ({
    poolOracles: entry.pool.map((card: any) => card.oracle_id),
    basicsOracles: entry.basics.filter((b: any) => b?.oracle_id).map((b: any) => b.oracle_id),
    maxSpells: entry.maxSpells ?? 23,
    maxLands: entry.maxLands ?? 17,
  }));

  const oracles = new Set<string>();
  for (const entry of coreEntries) {
    for (const o of entry.poolOracles) oracles.add(o);
    for (const o of entry.basicsOracles) oracles.add(o);
  }
  const facts = computeDeckbuildFacts(oracles);

  const ml: DeckbuildMlFns = {
    batchBuild: (inputs) => withMlRetry('batch deckbuild (build)', () => batchBuildOrThrow(inputs)),
    batchDraft: (inputs) => withMlRetry('batch deckbuild (draft)', () => batchDraftOrThrow(inputs)),
  };

  return runBatchDeckbuild(coreEntries, facts, ml);
};

export { calculateBasics, draftbotPick };
export default {
  draftbotPick,
  deckbuild,
  batchDeckbuild,
  calculateBasics,
};
