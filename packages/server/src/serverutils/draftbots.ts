import carddb, { cardFromId, getReasonableCardByOracle } from './carddb';
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

const pipsPerSource = (cards: any[]): Record<string, number> => {
  const pips: Record<string, number> = {
    W: 0.0,
    U: 0.0,
    B: 0.0,
    R: 0.0,
    G: 0.0,
  };

  const sources: Record<string, number> = {
    W: 1.0,
    U: 1.0,
    B: 1.0,
    R: 1.0,
    G: 1.0,
  };

  for (const card of cards) {
    if (card.type.includes('Land')) {
      for (const color of card.color_identity) {
        if (sources[color] !== undefined) {
          sources[color] += 1;
        }
      }
    } else {
      for (const color of card.parsed_cost) {
        const upperColor = color.toUpperCase();
        if (pips[upperColor] !== undefined) {
          pips[upperColor] += 1;
        }
      }
    }
  }

  return {
    W: (pips.W ?? 0) / (sources.W ?? 1),
    U: (pips.U ?? 0) / (sources.U ?? 1),
    B: (pips.B ?? 0) / (sources.B ?? 1),
    R: (pips.R ?? 0) / (sources.R ?? 1),
    G: (pips.G ?? 0) / (sources.G ?? 1),
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
    const pips = pipsPerSource([...mainboard, ...result]);

    let bestBasic = 0;
    let score = basicLands[0].color_identity
      .map((color: string) => pips[color] ?? 0)
      .reduce((a: number, b: number) => a + b, 0);
    //Cube's are not restricted to having 1 of each basic land. Could have multiple of a basic land type or none of a type
    for (let j = 1; j < basicLands.length; j++) {
      const newScore = basicLands[j].color_identity
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

  // Phase 1: Use deckbuild model to seed the first 10 cards
  const buildResult = await build(poolOracles);

  const mainboard: string[] = [];
  const remainingPool = [...poolOracles]; // tracks available copies
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

    const oracle = item.oracle;
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

    if (land) landCount++;
    else spellCount++;
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

    // Deduplicate candidates for the draft call (it expects unique oracle IDs in pack)
    const uniqueCandidates = [...new Set(candidates)];

    const draftResult = await draftbotPick(uniqueCandidates, mainboard);

    // Apply duplicate penalty and pick the best
    let bestOracle: string | null = null;
    let bestScore = -Infinity;

    for (const item of draftResult) {
      const existing = deckCopies[item.oracle] ?? 0;
      const adjustedRating = item.rating * Math.pow(0.9, existing);
      if (adjustedRating > bestScore) {
        bestScore = adjustedRating;
        bestOracle = item.oracle;
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
    if (land) landCount++;
    else spellCount++;
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
  const allBuildResults = await batchBuild(allPoolOracles);

  for (let s = 0; s < seats.length; s++) {
    const seat = seats[s]!;
    const buildResult = allBuildResults[s] || [];

    for (const item of buildResult) {
      if (seat.mainboard.length >= 10) break;

      const oracle = item.oracle;
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

      if (land) seat.landCount++;
      else seat.spellCount++;
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
        pack: [...new Set(candidates)], // unique oracles for the draft model
        pool: seat.mainboard,
      });
    }

    if (batchInputs.length === 0) break;

    const batchResults = await batchDraft(batchInputs);

    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = seats[s]!;
      const draftResult = batchResults[i] || [];

      // Apply duplicate penalty and pick the best
      let bestOracle: string | null = null;
      let bestScore = -Infinity;

      for (const item of draftResult) {
        const existing = seat.deckCopies[item.oracle] ?? 0;
        const adjustedRating = item.rating * Math.pow(0.9, existing);
        if (adjustedRating > bestScore) {
          bestScore = adjustedRating;
          bestOracle = item.oracle;
        }
      }

      if (!bestOracle || bestScore <= 0) continue;

      const poolIdx = seat.remainingPool.indexOf(bestOracle);
      if (poolIdx === -1) continue;

      seat.mainboard.push(bestOracle);
      seat.deckCopies[bestOracle] = (seat.deckCopies[bestOracle] ?? 0) + 1;
      seat.remainingPool.splice(poolIdx, 1);

      const land = oracleIsLand(bestOracle);
      if (land) seat.landCount++;
      else seat.spellCount++;

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
