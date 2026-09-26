import { BaseObject } from './BaseObject';

/** One of the 16 tiles on the board. */
export interface SynergyConnectCard {
  name: string;
  oracleId: string;
}

/**
 * A commander and the four cards that synergize with it — one of the four
 * hidden categories the player has to find.
 */
export interface SynergyConnectGroup {
  commander: SynergyConnectCard;
  cards: SynergyConnectCard[];
}

export interface SynergyConnectPuzzle extends BaseObject {
  id: string; // Puzzle date, YYYY-MM-DD (one puzzle per day)
  type: string; // Constant 'HISTORY' for GSI querying
  date: string;
  // The pool the commanders were drawn from, e.g. `keyword:Flying`, with its
  // human-readable translation. Shown as flavor, not as a hint.
  theme: {
    filterText: string;
    description: string;
  };
  groups: SynergyConnectGroup[]; // 4 groups of 4
  // Board order: indices into the flattened [group][card] list, so every
  // player sees the same shuffled board.
  order: number[];
  isActive: boolean;
}

export type NewSynergyConnectPuzzle = Omit<SynergyConnectPuzzle, 'id' | 'type' | 'dateCreated' | 'dateLastUpdated'>;

/**
 * The board as the client is allowed to see it: no group membership, no
 * commander names — those would give the puzzle away in the page source.
 */
export interface SynergyConnectBoard {
  date: string;
  theme: SynergyConnectPuzzle['theme'];
  cards: SynergyConnectCard[]; // 16, in board order
  // Groups the viewer has already solved, revealed in full.
  solvedGroups: SynergyConnectGroup[];
}

export interface SynergyConnectSubmission extends BaseObject {
  userId: string;
  date: string;
  // Group indices solved, in the order the player got them.
  solvedGroups: number[];
  // Each guess as the group index of the four selected cards, e.g. [0,0,0,2].
  // This is exactly what the share grid renders.
  guesses: number[][];
  mistakes: number;
  completedAt?: number;
}

export type NewSynergyConnectSubmission = Omit<SynergyConnectSubmission, 'dateCreated' | 'dateLastUpdated'>;

export interface SynergyConnectUserStats extends BaseObject {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate?: string;
  totalPlayed: number;
  totalSolved: number; // Groups solved across all puzzles
  perfectDays: number; // Completed with zero mistakes
}

export type NewSynergyConnectUserStats = Omit<SynergyConnectUserStats, 'dateCreated' | 'dateLastUpdated'>;

/** Mistakes allowed before the game ends, matching the genre standard. */
export const SYNERGY_CONNECT_MAX_MISTAKES = 4;
