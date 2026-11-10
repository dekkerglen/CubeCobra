// Pure record handling for processTrainingData: the data window, the hashed train/test split, and
// cleaning exported cubes, decks and picks into card-index lists.
import { TEST_PERCENT, WINDOW_YEARS } from './config';

// 32-bit FNV-1a. Stable across runs and machines, which Math.random splits are not.
export const fnv1a = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

/** Every deck and pick of a draft shares the draft id, so a draft never straddles the split. */
export const isTestRecord = (id: string, testPercent: number = TEST_PERCENT): boolean =>
  fnv1a(id) % 100 < testPercent;

export const windowStartFor = (exportedAt: number, years: number = WINDOW_YEARS): number => {
  const start = new Date(exportedAt);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return start.valueOf();
};

const isCardIndex =
  (numCards: number) =>
  (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= 0 && (value as number) < numCards;

/** Unique, sorted card indices; drops the export's -1 placeholders for unknown cards. */
export const cleanCube = (cards: unknown[], numCards: number): number[] =>
  [...new Set(cards.filter(isCardIndex(numCards)))].sort((a, b) => a - b);

// `date` is null for drafts with no usable date, and absent in exports made before it was added.
export interface ExportedDeck {
  id: string;
  date?: number | null;
  mainboard: number[];
  sideboard: number[];
  basics?: number[];
}

export interface CleanDeck {
  mainboard: number[];
  sideboard: number[];
}

/** Strips placeholders and basic lands, which say nothing about the deck. */
export const cleanDeck = (deck: ExportedDeck, numCards: number): CleanDeck => {
  const basics = new Set(deck.basics || []);
  const keep = (card: unknown): card is number => isCardIndex(numCards)(card) && !basics.has(card);
  return {
    mainboard: (deck.mainboard || []).filter(keep),
    sideboard: (deck.sideboard || []).filter(keep),
  };
};

export interface ExportedPick {
  draft: string;
  date?: number | null;
  pack: number[];
  pool: number[];
  picked: number;
}

export interface CleanPick {
  pool: number[];
  pack: number[];
  pick: number;
}

/**
 * Null when the pick can't teach anything: the picked card is unknown or missing from its pack,
 * or the pack had no real choice left.
 */
export const cleanPick = (pick: ExportedPick, numCards: number): CleanPick | null => {
  const isCard = isCardIndex(numCards);
  if (!isCard(pick.picked)) return null;
  const pack = (pick.pack || []).filter(isCard);
  if (!pack.includes(pick.picked) || pack.length <= 1) return null;
  const pool = (pick.pool || []).filter((card) => isCard(card) && card !== pick.picked);
  return { pool, pack, pick: pick.picked };
};
