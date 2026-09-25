import { BaseObject } from './BaseObject';

/**
 * A single row or column category of the daily ManaMatrix puzzle.
 * `filterText` is CubeCobra filter syntax (e.g. `cmc=3`, `otag:boardwipe`);
 * `description` is the human-readable translation, precomputed at generation
 * time via filterToReadableString so the client never compiles filters.
 */
export interface ManaMatrixCategory {
  filterText: string;
  description: string;
}

export interface ManaMatrixPuzzle extends BaseObject {
  id: string; // Puzzle date, YYYY-MM-DD (one puzzle per day)
  type: string; // Constant 'HISTORY' for GSI querying
  date: string; // Same as id; kept explicit for GSI sort keys
  columns: ManaMatrixCategory[]; // 3 column categories
  rows: ManaMatrixCategory[]; // 3 row categories
  counts: number[][]; // counts[row][col] = number of distinct card names matching both filters
  isActive: boolean; // Whether this is the current daily puzzle
}

export type NewManaMatrixPuzzle = Omit<ManaMatrixPuzzle, 'id' | 'type' | 'dateCreated' | 'dateLastUpdated'>;

/**
 * A logged-in user's answers for one puzzle. Updated in place on each attempt.
 */
export interface ManaMatrixSubmission extends BaseObject {
  userId: string;
  date: string; // Puzzle date, YYYY-MM-DD
  answers: (string | null)[][]; // answers[row][col] = card name as entered, or null
  correct: boolean[][]; // correct[row][col], merged across attempts
  attempts: number;
  // Cells already counted toward answer popularity, so a cell is only ever
  // counted once per user: "row,col" -> normalized card name that was counted.
  countedCells: Record<string, string>;
  completedAt?: number; // Set when all 9 cells are correct
}

export type NewManaMatrixSubmission = Omit<ManaMatrixSubmission, 'dateCreated' | 'dateLastUpdated'>;

/**
 * Aggregate per-user stats. Streaks only advance on the active day's puzzle.
 */
export interface ManaMatrixUserStats extends BaseObject {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate?: string; // YYYY-MM-DD of the last active-day submission
  totalPlayed: number; // Days with at least one submission
  totalCellsCorrect: number;
  perfectDays: number; // Days completed 9/9
}

export type NewManaMatrixUserStats = Omit<ManaMatrixUserStats, 'dateCreated' | 'dateLastUpdated'>;

/**
 * Per-cell answer tallies for one puzzle (9 items per day, created zeroed at
 * rotation). Drives the "N% of players gave this answer" popularity display.
 */
export interface ManaMatrixCellStats extends BaseObject {
  date: string; // Puzzle date, YYYY-MM-DD
  row: number;
  col: number;
  totalAnswers: number;
  answerCounts: Record<string, number>; // normalized card name -> times given
}

export type NewManaMatrixCellStats = Omit<ManaMatrixCellStats, 'dateCreated' | 'dateLastUpdated'>;

/** Popularity of one correct answer, as returned by the submit API. */
export interface ManaMatrixCellPopularity {
  count: number;
  total: number;
  percentage: number;
}

/** One valid answer for a cell and how often the community gave it. */
export interface ManaMatrixCellAnalysisEntry {
  name: string;
  guesses: number;
  percentage: number;
}

/** Community answer breakdown for one cell, as returned by the analysis API. */
export interface ManaMatrixCellAnalysis {
  totalGuesses: number;
  totalCards: number;
  validCards: ManaMatrixCellAnalysisEntry[];
}
