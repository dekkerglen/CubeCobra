import carddb, { cardFromId, getOracleForMl, getReasonableCardByOracle } from './carddb';
import { batchBuild, batchDraft, build, draft as draftbotPick } from './ml';

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

/**
 * Returns color_demand / sources for each color.
 * color_demand = number of non-land cards whose color_identity includes that color.
 * sources = 1 (baseline) + number of lands already in the deck that can produce that color.
 *
 * Using color_identity instead of parsed_cost because color_identity is reliably populated
 * on every card, whereas parsed_cost may be empty and would cause all pips to be 0,
 * making every basic land tie and only the first one ever being selected.
 *
 * produced_mana is used for lands (with color_identity fallback) so that fetchlands
 * and other lands without color_identity are counted correctly as mana sources.
 */
const colorDemandPerSource = (cards: any[]): Record<string, number> => {
  const demand: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const sources: Record<string, number> = { W: 1, U: 1, B: 1, R: 1, G: 1 };

  for (const card of cards) {
    if ((card.type ?? '').includes('Land')) {
      const produced: string[] = card.produced_mana?.length > 0 ? card.produced_mana : (card.color_identity ?? []);
      for (const color of produced) {
        if (sources[color] !== undefined) sources[color] += 1;
      }
    } else {
      for (const color of card.color_identity ?? []) {
        if (demand[color] !== undefined) demand[color] += 1;
      }
    }
  }

  return {
    W: (demand.W ?? 0) / (sources.W ?? 1),
    U: (demand.U ?? 0) / (sources.U ?? 1),
    B: (demand.B ?? 0) / (sources.B ?? 1),
    R: (demand.R ?? 0) / (sources.R ?? 1),
    G: (demand.G ?? 0) / (sources.G ?? 1),
  };
};

const calculateBasics = (mainboard: any[], basics: any[], deckSize: number = 40): any[] => {
  if (basics.length === 0) {
    return [];
  }

  const result = [];

  const basicsNeeded = deckSize - mainboard.length;

  const basicLands = basics.filter((card: any) => card.type.includes('Land'));
  //Cube basics don't have to be actual land cards (could be land art cards or just regular cards).
  //We need lands though in order to calculate pip sources and if none are found we bail, and the bot gets no basics added
  if (basicLands.length === 0) {
    return [];
  }

  for (let i = 0; i < basicsNeeded; i++) {
    const pips = colorDemandPerSource([...mainboard, ...result]);

    const basicColors = (card: any): string[] =>
      card.produced_mana?.length > 0 ? card.produced_mana : card.color_identity;

    let bestBasic = 0;
    let score = basicColors(basicLands[0])
      .map((color: string) => pips[color] ?? 0)
      .reduce((a: number, b: number) => a + b, 0);
    //Cube's are not restricted to having 1 of each basic land. Could have multiple of a basic land type or none of a type
    for (let j = 1; j < basicLands.length; j++) {
      const newScore = basicColors(basicLands[j])
        .map((color: string) => pips[color] ?? 0)
        .reduce((a: number, b: number) => a + b, 0);
      if (newScore > score) {
        bestBasic = j;
        score = newScore;
      }
    }

    result.push(basicLands[bestBasic]);
  }

  return result;
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
  const buildResult = await build(poolMlOracles);

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
      const land = oracleIsLand(oracle);
      if (land && landCount >= maxLands) return false;
      if (!land && spellCount >= maxSpells) return false;
      return true;
    });

    if (candidates.length === 0) break;

    // Deduplicate ML oracles for the draft call
    const uniqueMlCandidates = [...new Set(candidates.map((o) => toMl[o] ?? o))];
    const mlMainboard = mainboard.map((o) => toMl[o] ?? o);

    const draftResult = await draftbotPick(uniqueMlCandidates, mlMainboard);

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
 * Build multiple bot decks in a single batched ML call.
 * Phase 1: batch deckbuild model to seed 10 cards per seat.
 * Phase 2: iteratively batch draft model to pick one card per seat per round.
 */
export const batchDeckbuild = async (
  entries: { pool: any[]; basics: any[]; maxSpells?: number; maxLands?: number }[],
): Promise<{ mainboard: string[]; sideboard: string[] }[]> => {
  if (entries.length === 0) return [];

  // Helper: check if an oracle is a land
  const oracleIsLand = (oracle: string): boolean => {
    const oracleIds = carddb.oracleToId[oracle];
    return !!(oracleIds && oracleIds[0] && cardFromId(oracleIds[0]).type.includes('Land'));
  };

  const allPoolOracles = entries.map((entry) => entry.pool.map((card: any) => card.oracle_id));

  // Build ML substitution maps per seat
  const seatMaps = allPoolOracles.map((poolOracles) => {
    const toMl: Record<string, string> = {};
    const fromMl: Record<string, string[]> = {};
    for (const oracle of poolOracles) {
      if (toMl[oracle] !== undefined) continue;
      const mlOracle = getOracleForMl(oracle, null);
      toMl[oracle] = mlOracle;
      if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
      if (!fromMl[mlOracle].includes(oracle)) fromMl[mlOracle].push(oracle);
    }
    return { toMl, fromMl };
  });

  // ML-substituted pool oracles for the batch build call
  const allPoolMlOracles = allPoolOracles.map((poolOracles, idx) => {
    const { toMl } = seatMaps[idx]!;
    return poolOracles.map((o) => toMl[o] ?? o);
  });

  // Per-seat state
  const seats = entries.map((entry, idx) => {
    const poolOracles = allPoolOracles[idx] || [];
    const maxSpells = entry.maxSpells ?? 23;
    const maxLands = entry.maxLands ?? 17;
    return {
      maxSpells,
      maxLands,
      deckSize: maxSpells + maxLands,
      mainboard: [] as string[],
      remainingPool: [...poolOracles],
      deckCopies: {} as Record<string, number>,
      spellCount: 0,
      landCount: 0,
      basics: entry.basics,
    };
  });

  // Phase 1: Batch deckbuild model to seed first 10 cards per seat
  let allBuildResults: Awaited<ReturnType<typeof batchBuild>>;
  try {
    allBuildResults = await batchBuild(allPoolMlOracles);
  } catch (err) {
    throw new Error(`Batch deckbuild (phase 1) failed: ${err instanceof Error ? err.message : err}`);
  }

  for (let s = 0; s < seats.length; s++) {
    const seat = seats[s]!;
    const { fromMl } = seatMaps[s]!;
    const buildResult = allBuildResults[s] || [];

    for (const item of buildResult) {
      if (seat.mainboard.length >= 10) break;

      const mlOracle = item.oracle;
      const originals = fromMl[mlOracle] ?? [mlOracle];
      const oracle = originals.find((o) => seat.remainingPool.includes(o));
      if (!oracle) continue;

      const land = oracleIsLand(oracle);

      if (land && seat.landCount >= seat.maxLands) continue;
      if (!land && seat.spellCount >= seat.maxSpells) continue;

      const poolIdx = seat.remainingPool.indexOf(oracle);
      if (poolIdx === -1) continue;

      const existing = seat.deckCopies[oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (adjustedRating <= 0) continue;

      seat.mainboard.push(oracle);
      seat.deckCopies[oracle] = existing + 1;
      seat.remainingPool.splice(poolIdx, 1);

      if (land) seat.landCount += 1;
      else seat.spellCount += 1;
    }
  }

  // Phase 2: Iteratively use draft model, batched across seats
  // Keep going until all seats are full or stuck
  let anyProgress = true;
  while (anyProgress) {
    anyProgress = false;

    // Build batch inputs for seats that still need cards
    const activeIndices: number[] = [];
    const batchInputs: { pack: string[]; pool: string[] }[] = [];

    for (let s = 0; s < seats.length; s++) {
      const seat = seats[s]!;
      const { toMl } = seatMaps[s]!;
      if (seat.mainboard.length >= seat.deckSize || seat.remainingPool.length === 0) continue;

      // Filter candidates that fit under limits
      const candidates = seat.remainingPool.filter((oracle) => {
        const land = oracleIsLand(oracle);
        if (land && seat.landCount >= seat.maxLands) return false;
        if (!land && seat.spellCount >= seat.maxSpells) return false;
        return true;
      });

      if (candidates.length === 0) continue;

      activeIndices.push(s);
      batchInputs.push({
        pack: [...new Set(candidates.map((o) => toMl[o] ?? o))], // unique ML oracles
        pool: seat.mainboard.map((o) => toMl[o] ?? o), // ML oracles for mainboard
      });
    }

    if (batchInputs.length === 0) break;

    let batchResults: Awaited<ReturnType<typeof batchDraft>>;
    try {
      batchResults = await batchDraft(batchInputs);
    } catch (err) {
      throw new Error(`Batch deckbuild (phase 2) failed: ${err instanceof Error ? err.message : err}`);
    }

    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = seats[s]!;
      const { fromMl } = seatMaps[s]!;
      const draftResult = batchResults[i] || [];

      // Apply duplicate penalty and pick the best, mapping back to originals
      let bestOracle: string | null = null;
      let bestScore = -Infinity;

      for (const item of draftResult) {
        const mlOracle = item.oracle;
        const originals = fromMl[mlOracle] ?? [mlOracle];
        const oracle = originals.find((o) => seat.remainingPool.includes(o));
        if (!oracle) continue;

        const existing = seat.deckCopies[oracle] ?? 0;
        const adjustedRating = item.rating * Math.pow(0.9, existing);
        if (adjustedRating > bestScore) {
          bestScore = adjustedRating;
          bestOracle = oracle;
        }
      }

      if (!bestOracle || bestScore <= 0) continue;

      const poolIdx = seat.remainingPool.indexOf(bestOracle);
      if (poolIdx === -1) continue;

      seat.mainboard.push(bestOracle);
      seat.deckCopies[bestOracle] = (seat.deckCopies[bestOracle] ?? 0) + 1;
      seat.remainingPool.splice(poolIdx, 1);

      const land = oracleIsLand(bestOracle);
      if (land) seat.landCount += 1;
      else seat.spellCount += 1;

      anyProgress = true;
    }
  }

  // Fill basics and build final results
  return seats.map((seat) => {
    seat.mainboard.push(
      ...calculateBasics(seat.mainboard.map(getReasonableCardByOracle), seat.basics, seat.deckSize).map(
        (card) => card.oracle_id,
      ),
    );

    return {
      mainboard: seat.mainboard.sort(),
      sideboard: seat.remainingPool.slice().sort(),
    };
  });
};

export { calculateBasics, draftbotPick };
export default {
  draftbotPick,
  deckbuild,
  batchDeckbuild,
  calculateBasics,
};
