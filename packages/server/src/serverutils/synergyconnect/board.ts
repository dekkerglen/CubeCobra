import {
  SynergyConnectBoard,
  SynergyConnectCard,
  SynergyConnectPuzzle,
  SynergyConnectSubmission,
} from '@utils/datatypes/SynergyConnect';

const GROUP_COUNT = 4;
const CARDS_PER_GROUP = 4;

/** The flattened card list in stored (group, card) order. */
const flatCards = (puzzle: SynergyConnectPuzzle): SynergyConnectCard[] => puzzle.groups.flatMap((group) => group.cards);

/** Which group a flat index belongs to. */
const groupOfIndex = (index: number): number => Math.floor(index / CARDS_PER_GROUP);

/**
 * The puzzle as the client may see it: cards in board order with NO group
 * membership and NO commander names, except for groups the viewer already
 * solved. Anything else would hand over the answer in the page source.
 */
export const toBoard = (
  puzzle: SynergyConnectPuzzle,
  submission?: SynergyConnectSubmission | null,
): SynergyConnectBoard => {
  const cards = flatCards(puzzle);

  return {
    date: puzzle.date,
    theme: puzzle.theme,
    // All sixteen stay on the board — solved ones are pinned to the top rows by
    // the client rather than removed, so the cards remain visible. Group
    // membership is still only derivable for groups already solved.
    cards: puzzle.order.map((index) => cards[index]!),
    solvedGroups: (submission?.solvedGroups ?? []).map((groupIndex) => puzzle.groups[groupIndex]!),
  };
};

/** Every group revealed — for a finished game (win or loss) or an archive review. */
export const revealAll = (puzzle: SynergyConnectPuzzle) => puzzle.groups;

export interface GuessResult {
  // The group all four cards belong to, or null when they don't match one.
  groupIndex: number | null;
  // Group index per selected card, for the share grid and "one away" feedback.
  guessGroups: number[];
  // Exactly three of the four share a group — the genre's standard near-miss hint.
  oneAway: boolean;
}

/**
 * Resolves a guess of four oracle ids against the puzzle. Returns null when the
 * selection isn't four distinct cards that are actually on the board.
 */
export const evaluateGuess = (puzzle: SynergyConnectPuzzle, oracleIds: string[]): GuessResult | null => {
  if (oracleIds.length !== CARDS_PER_GROUP || new Set(oracleIds).size !== CARDS_PER_GROUP) {
    return null;
  }

  const cards = flatCards(puzzle);
  const guessGroups: number[] = [];
  for (const oracleId of oracleIds) {
    const index = cards.findIndex((card) => card.oracleId === oracleId);
    if (index < 0) {
      return null;
    }
    guessGroups.push(groupOfIndex(index));
  }

  const counts = new Map<number, number>();
  for (const groupIndex of guessGroups) {
    counts.set(groupIndex, (counts.get(groupIndex) ?? 0) + 1);
  }

  const best = Math.max(...counts.values());
  return {
    groupIndex: best === CARDS_PER_GROUP ? guessGroups[0]! : null,
    guessGroups,
    oneAway: best === CARDS_PER_GROUP - 1,
  };
};

export const isComplete = (submission: SynergyConnectSubmission): boolean =>
  submission.solvedGroups.length >= GROUP_COUNT;
