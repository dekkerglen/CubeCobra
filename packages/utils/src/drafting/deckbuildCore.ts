/**
 * Carddb-free bot deckbuilding core.
 *
 * This is the batched deckbuild algorithm (seed with the build model, iteratively pick with
 * the draft model, then manabase-trim and add basics) with every card-database dependency
 * lifted out into an injected `facts` map and every ML call injected via `ml`. That lets it
 * run anywhere the facts are available — in particular the bot-deckbuild lambda, which ships
 * the facts in its job payload instead of loading the ~100 MB card database.
 *
 * The server keeps identical behaviour by computing `facts` from carddb and wiring `ml` to
 * the recommender (see serverutils/draftbots.batchDeckbuild), so this file must stay a
 * faithful port of that algorithm.
 */
import { type LandTrimDeck, runManabaseTrim } from './landTrim';
import { type BasicCardLike, type LandMetaLookup, pickAddedBasics } from './manabaseHeuristics';

/** Everything the algorithm needs to know about a single oracle id, precomputed from carddb. */
export interface OracleFacts {
  // The oracle id the ML models were trained on (may fold alternates together).
  mlOracle: string;
  isLand: boolean;
  // Conspiracy/Vanguard cards affect the draft but never belong in a constructed mainboard.
  isConspiracyOrVanguard: boolean;
  name: string;
  type: string;
  colorIdentity: string[];
  producedMana: string[];
  isManaFixingLand?: boolean;
}

export type OracleFactsMap = Record<string, OracleFacts>;

export interface DeckbuildEntry {
  // Pool oracle ids (with duplicates, one per drafted card).
  poolOracles: string[];
  // Basic-land oracle ids available to fill out the manabase.
  basicsOracles: string[];
  maxSpells: number;
  maxLands: number;
}

export interface DeckbuildMlFns {
  batchBuild: (inputs: string[][]) => Promise<{ oracle: string; rating: number }[][]>;
  batchDraft: (inputs: { pack: string[]; pool: string[] }[]) => Promise<{ oracle: string; rating: number }[][]>;
}

/**
 * Self-contained payload the server writes to S3 and the bot-deckbuild lambda reads. Carries
 * everything needed to build (and name) a draft's bot decks without touching carddb: the
 * pool/basics as card indices + oracle + precomputed grid position, and the oracle facts.
 */
export interface DeckbuildJobCard {
  // Index into the draft's `cards` array — used to reconstruct the seat mainboard/sideboard.
  index: number;
  oracle: string;
  // Precomputed getCardDefaultRowColumn(card) so the lambda needs no carddb/cardutil to lay out.
  row: number;
  col: number;
}

export interface DeckbuildJobSeat {
  // Index into the draft's `seats` array (which seat this build belongs to).
  seatIndex: number;
  // The seat's expanded picks, in order (with duplicates).
  pool: DeckbuildJobCard[];
}

export interface DeckbuildJob {
  draftId: string;
  maxSpells: number;
  maxLands: number;
  seats: DeckbuildJobSeat[];
  // Basic lands available to fill out manabases, as index/oracle/position.
  basics: DeckbuildJobCard[];
  facts: OracleFactsMap;
}

// S3 key prefix for deckbuild job payloads (deckbuildjobs/{draftId}.json). Shared so the
// server (writer) and the bot-deckbuild lambda (reader) can't drift.
export const DECKBUILD_JOB_PREFIX = 'deckbuildjobs';
export const deckbuildJobKey = (draftId: string): string => `${DECKBUILD_JOB_PREFIX}/${draftId}.json`;

const metaFromFacts = (oracle: string, facts: OracleFactsMap): LandMetaLookup[string] | undefined => {
  const f = facts[oracle];
  if (!f) return undefined;
  return {
    name: f.name,
    type: f.type,
    colorIdentity: f.colorIdentity,
    producedMana: f.producedMana,
    isManaFixingLand: f.isManaFixingLand,
  };
};

const buildCardMeta = (oracles: Iterable<string>, facts: OracleFactsMap): LandMetaLookup => {
  const lookup: LandMetaLookup = {};
  for (const oracle of oracles) {
    if (lookup[oracle]) continue;
    const meta = metaFromFacts(oracle, facts);
    if (meta) lookup[oracle] = meta;
  }
  return lookup;
};

// Facts-based port of serverutils/draftbots.calculateBasics. Returns the oracle ids of the
// basics to append to the mainboard.
const calculateBasics = (
  mainboardOracles: string[],
  basicsOracles: string[],
  facts: OracleFactsMap,
  deckSize: number,
): string[] => {
  const cardMeta = buildCardMeta([...mainboardOracles, ...basicsOracles], facts);

  const mainboardKeys = mainboardOracles.map((oracle, index) => {
    const key = oracle ?? `__mainboard_${index}`;
    if (!cardMeta[key]) {
      const f = facts[oracle];
      cardMeta[key] = {
        name: f?.name ?? key,
        type: f?.type ?? '',
        colorIdentity: f?.colorIdentity ?? [],
        producedMana: f?.producedMana ?? [],
      };
    }
    return key;
  });

  const basicCards: Array<BasicCardLike & { card: string }> = basicsOracles.map((oracle) => {
    const f = facts[oracle];
    return {
      card: oracle,
      oracleId: oracle,
      type: f?.type ?? '',
      colorIdentity: f?.colorIdentity ?? [],
      producedMana: f?.producedMana ?? [],
    };
  });

  return pickAddedBasics(mainboardKeys, cardMeta, basicCards, deckSize).map((basic) => basic.card);
};

/**
 * Build multiple bot decks in one batched pass, sharing ML calls across every seat.
 * Faithful port of serverutils/draftbots.batchDeckbuild with carddb + ml injected.
 */
export const runBatchDeckbuild = async (
  entries: DeckbuildEntry[],
  facts: OracleFactsMap,
  ml: DeckbuildMlFns,
): Promise<{ mainboard: string[]; sideboard: string[] }[]> => {
  if (entries.length === 0) return [];

  const isLand = (oracle: string): boolean => facts[oracle]?.isLand ?? false;
  const isConspiracyOrVanguard = (oracle: string): boolean => facts[oracle]?.isConspiracyOrVanguard ?? false;
  const toMlOracle = (oracle: string): string => facts[oracle]?.mlOracle ?? oracle;

  const allPoolOracles = entries.map((entry) => entry.poolOracles);

  // Build ML substitution maps per seat: original oracle <-> ML oracle.
  const seatMaps = allPoolOracles.map((poolOracles) => {
    const toMl: Record<string, string> = {};
    const fromMl: Record<string, string[]> = {};
    for (const oracle of poolOracles) {
      if (toMl[oracle] !== undefined) continue;
      const mlOracle = toMlOracle(oracle);
      toMl[oracle] = mlOracle;
      if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
      if (!fromMl[mlOracle].includes(oracle)) fromMl[mlOracle].push(oracle);
    }
    return { toMl, fromMl };
  });

  const allPoolMlOracles = allPoolOracles.map((poolOracles, idx) => {
    const { toMl } = seatMaps[idx]!;
    return poolOracles.map((o) => toMl[o] ?? o);
  });

  const seats = entries.map((entry, idx) => {
    const poolOracles = allPoolOracles[idx] || [];
    return {
      maxSpells: entry.maxSpells,
      maxLands: entry.maxLands,
      deckSize: entry.maxSpells + entry.maxLands,
      mainboard: [] as string[],
      remainingPool: [...poolOracles],
      deckCopies: {} as Record<string, number>,
      spellCount: 0,
      landCount: 0,
      basicsOracles: entry.basicsOracles,
    };
  });

  // Phase 1: batch deckbuild (build model) to seed the first 10 cards per seat.
  const allBuildResults = await ml.batchBuild(allPoolMlOracles);

  for (let s = 0; s < seats.length; s++) {
    const seat = seats[s]!;
    const { fromMl } = seatMaps[s]!;
    const buildResult = allBuildResults[s] || [];

    for (const item of buildResult) {
      if (seat.mainboard.length >= 10) break;

      const originals = fromMl[item.oracle] ?? [item.oracle];
      const oracle = originals.find((o) => seat.remainingPool.includes(o));
      if (!oracle) continue;

      if (isConspiracyOrVanguard(oracle)) continue;

      const land = isLand(oracle);
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

  // Phase 2: iteratively use the draft model, batched across seats, until all are full/stuck.
  let anyProgress = true;
  while (anyProgress) {
    anyProgress = false;

    const activeIndices: number[] = [];
    const batchInputs: { pack: string[]; pool: string[] }[] = [];

    for (let s = 0; s < seats.length; s++) {
      const seat = seats[s]!;
      const { toMl } = seatMaps[s]!;
      if (seat.mainboard.length >= seat.deckSize || seat.remainingPool.length === 0) continue;

      const candidates = seat.remainingPool.filter((oracle) => {
        if (isConspiracyOrVanguard(oracle)) return false;
        const land = isLand(oracle);
        if (land && seat.landCount >= seat.maxLands) return false;
        if (!land && seat.spellCount >= seat.maxSpells) return false;
        return true;
      });

      if (candidates.length === 0) continue;

      activeIndices.push(s);
      batchInputs.push({
        pack: [...new Set(candidates.map((o) => toMl[o] ?? o))],
        pool: seat.mainboard.map((o) => toMl[o] ?? o),
      });
    }

    if (batchInputs.length === 0) break;

    const batchResults = await ml.batchDraft(batchInputs);

    for (let i = 0; i < activeIndices.length; i++) {
      const s = activeIndices[i]!;
      const seat = seats[s]!;
      const { fromMl } = seatMaps[s]!;
      const draftResult = batchResults[i] || [];

      let bestOracle: string | null = null;
      let bestScore = -Infinity;

      for (const item of draftResult) {
        const originals = fromMl[item.oracle] ?? [item.oracle];
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

      if (isLand(bestOracle)) seat.landCount += 1;
      else seat.spellCount += 1;

      anyProgress = true;
    }
  }

  // Manabase trim: shared heuristic layer + batched ML reranks. Cut lands land in the sideboard.
  const trimDecks: LandTrimDeck[] = seats.map((seat) => ({
    mainboard: seat.mainboard,
    sideboard: seat.remainingPool,
    basics: seat.basicsOracles.map<BasicCardLike>((oracle) => ({
      oracleId: oracle,
      type: facts[oracle]?.type ?? '',
      colorIdentity: facts[oracle]?.colorIdentity ?? [],
      producedMana: facts[oracle]?.producedMana ?? [],
    })),
    deckSize: seat.deckSize,
    maxLands: seat.maxLands,
    cardMeta: buildCardMeta([...seat.mainboard, ...seat.remainingPool, ...seat.basicsOracles], facts),
    originalPool: [...seat.mainboard, ...seat.remainingPool],
  }));
  try {
    await runManabaseTrim(trimDecks, (inputs) => ml.batchDraft(inputs));
  } catch (err) {
    // Ship the partially-trimmed decks rather than dropping the whole build.
    console.warn('batch deckbuild manabase trim failed; shipping partial trim', err);
  }

  return seats.map((seat) => {
    seat.mainboard.push(...calculateBasics(seat.mainboard, seat.basicsOracles, facts, seat.deckSize));
    return {
      mainboard: seat.mainboard.sort(),
      sideboard: seat.remainingPool.slice().sort(),
    };
  });
};
