import { cardOracleId, isCustomOrVoucher } from './cardutil';
import Card, { BoardType, Changes, isBoardChanges } from './datatypes/Card';

export interface CleanupCardRef {
  index: number;
  board: BoardType;
}

/**
 * The identity cleanup groups on. Returns null for any card cleanup must never group:
 * custom cards and vouchers (which all share a single sentinel cardID), and cards whose
 * oracle id is empty (including non-custom cards whose details failed to hydrate).
 */
export const cleanupOracleKey = (card: Card): string | null => {
  if (isCustomOrVoucher(card)) {
    return null;
  }

  const oracleId = cardOracleId(card);
  return oracleId === '' ? null : oracleId;
};

/*
 * Shared by every cleanup rule: returns the key a card should be grouped under, or null if
 * the card is not a cleanup candidate — no usable identity, no stamped board position,
 * already staged for removal, or swapped out.
 */
const cleanupGroupKey = (card: Card, isSwapped?: (card: Card) => boolean): string | null => {
  const oracleKey = cleanupOracleKey(card);
  if (oracleKey === null || card.index === undefined || card.board === undefined) {
    return null;
  }

  return card.markedForDelete || isSwapped?.(card) ? null : oracleKey;
};

const addedTmspValue = (card: Card): number => {
  // Missing, blank, or unparseable timestamps sort as the newest, so a card with no
  // data never wins the "oldest" criterion. Guard the blank case explicitly, since
  // Number('') is 0 and would otherwise read as the epoch.
  const raw = card.addedTmsp?.trim();
  if (!raw) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

/*
 * Oldest first. Compared rather than subtracted so two missing timestamps give 0 instead
 * of the NaN that Infinity - Infinity would produce.
 */
const compareAddedTmsp = (a: Card, b: Card): number => {
  const aValue = addedTmspValue(a);
  const bValue = addedTmspValue(b);
  if (aValue === bValue) {
    return 0;
  }

  return aValue < bValue ? -1 : 1;
};

/*
 * Orders a group best-survivor first: most tags, then longest notes, then oldest
 * addedTmsp, then lowest index so the result never depends on array order.
 */
const compareSurvivors = (a: Card, b: Card): number =>
  (b.tags?.length ?? 0) - (a.tags?.length ?? 0) ||
  (b.notes?.length ?? 0) - (a.notes?.length ?? 0) ||
  compareAddedTmsp(a, b) ||
  a.index! - b.index!;

/**
 * Finds the redundant entries within a single board: for every oracle id with more than
 * one eligible copy, every copy except the best survivor. Returned in ascending index order.
 */
export const findDuplicateRemovals = (cards: Card[], isSwapped?: (card: Card) => boolean): CleanupCardRef[] => {
  const groups = new Map<string, Card[]>();

  for (const card of cards) {
    const key = cleanupGroupKey(card, isSwapped);
    if (key === null) {
      continue;
    }

    const group = groups.get(key);
    if (group) {
      group.push(card);
    } else {
      groups.set(key, [card]);
    }
  }

  const removals: CleanupCardRef[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const [, ...losers] = [...group].sort(compareSurvivors);
    for (const card of losers) {
      removals.push({ index: card.index!, board: card.board! });
    }
  }

  return removals.sort((a, b) => a.index - b.index);
};

/**
 * Finds the entries of one board that are already represented in another: every eligible
 * target card whose oracle id appears on the reference board. No survivor is kept, because
 * each removed card remains available on the reference board. The same exclusions apply to
 * both sides. Returned in ascending index order.
 */
export const findOverlapRemovals = (
  targetCards: Card[],
  referenceCards: Card[],
  isSwapped?: (card: Card) => boolean,
): CleanupCardRef[] => {
  const referenceKeys = new Set<string>();
  for (const card of referenceCards) {
    const key = cleanupGroupKey(card, isSwapped);
    if (key !== null) {
      referenceKeys.add(key);
    }
  }

  const removals: CleanupCardRef[] = [];
  for (const card of targetCards) {
    const key = cleanupGroupKey(card, isSwapped);
    if (key !== null && referenceKeys.has(key)) {
      removals.push({ index: card.index!, board: card.board! });
    }
  }

  return removals.sort((a, b) => a.index - b.index);
};

const swapPositionKey = (board: BoardType, index: number): string => `${board}:${index}`;

/**
 * Builds a predicate reporting whether a card sits at a board position with a staged swap.
 * The swapped positions are collected once, since the predicate runs for every card of the
 * cube on every render.
 */
export const makeSwapPredicate = (changes: Changes): ((card: Card) => boolean) => {
  const swappedPositions = new Set<string>();

  // Changes carries a numeric `version` alongside the boards, so narrow each value.
  for (const [board, boardChanges] of Object.entries(changes)) {
    if (!isBoardChanges(boardChanges)) {
      continue;
    }

    for (const swap of boardChanges.swaps ?? []) {
      swappedPositions.add(swapPositionKey(board, swap.index));
    }
  }

  return (card: Card): boolean =>
    card.index !== undefined &&
    card.board !== undefined &&
    swappedPositions.has(swapPositionKey(card.board, card.index));
};
