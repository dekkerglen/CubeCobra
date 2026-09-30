import { BaseObject } from './BaseObject';

/**
 * Where a piece of crossword vocabulary came from. The class is carried through
 * fill so clue generation can pick the right phrasing per entry later.
 */
export type CrosswordEntryClass =
  | 'cardName'
  | 'nameWord'
  | 'nameBigram'
  | 'acronym'
  | 'creatureType'
  | 'keyword'
  | 'legendName'
  | 'legendTitle'
  | 'setCode'
  | 'oracleWord';

export interface CrosswordVocabEntry {
  /** Letters only, uppercase — what actually goes in the grid. */
  text: string;
  /** Human-readable form, e.g. "Thrun, the Last Troll". */
  display: string;
  entryClass: CrosswordEntryClass;
  /** The card this came from, for clue generation. Absent for types/keywords. */
  sourceCardName?: string;
  sourceOracleId?: string;
  /**
   * Every card a clue may cite, `sourceCardName` first. Clues are generated per
   * puzzle rather than stored, so an entry with one source always clues the same
   * way; a pool lets successive puzzles vary. Populated for nameWord and
   * nameBigram.
   */
  sourceCardNames?: string[];
  /** Set code, for setCode entries. */
  setCode?: string;
  /** YYYY-MM-DD, for setCode entries (clues distinguish reprint-only sets). */
  setReleasedAt?: string | null;
  /** True when no card had its first printing in this set. */
  reprintOnly?: boolean;
  /**
   * Distinct cards this entry was counted on, for oracleWord (cards whose rules
   * text uses it) and nameWord / nameBigram (cards whose name contains it).
   */
  frequency?: number;
}

export type CrosswordSymmetry = 'rotational180' | 'rotational90' | 'none';

export interface CrosswordSlot {
  id: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
  length: number;
  /** Clue number shown in the grid. */
  number: number;
}

export interface CrosswordFilledSlot extends CrosswordSlot {
  entry: CrosswordVocabEntry;
  /** Filled with arbitrary letters because no real word fit the crossings. */
  nonsense?: boolean;
  /**
   * The clue the solver reads, e.g. "Jace, the ____ Sculptor" or "color identity
   * is exactly Green, type line includes Elf, mana value is 1". Always computed
   * on the server: clue phrasing needs the vocabulary, the card catalog and a
   * filter engine, none of which the client has. Generated per puzzle from the
   * puzzle seed, never stored.
   *
   * Never contains its own answer, and never a match count: how many cards a
   * filter-based clue admits is a tell about how constrained the answer is.
   */
  clue?: string;
  /**
   * The filter `clue` is the translation of, e.g. `ci=g t:elf mv=1`, for the four
   * classes clued by a narrowing filter. A second field rather than part of
   * `clue` so a caller can render (or drop) the Scryfall syntax on its own — the
   * lab shows it under the clue, the daily game need not show it at all.
   */
  clueFilter?: string;
  /**
   * The one card `clue` cites, for the shapes that blank a word out of a card
   * name or quote a card's rules text. Stored, and shown in the answer key in
   * place of `entry.display`.
   *
   * Those shapes pick their card from a pool with the puzzle's rng, so the card
   * the clue is about is not the card the entry is displayed as. Without this the
   * key contradicts the clue it is explaining: REITO clued as "____ Lantern" came
   * back as "Reito Sentinel". Absent for the shapes that cite no particular card,
   * where `entry.display` is the right thing to show.
   */
  clueSource?: string;
}

export interface CrosswordPuzzleGrid {
  width: number;
  height: number;
  /** Blocks the generator had to add to make the grid fillable. */
  blockCount: number;
  /** true = black square. Row-major, height rows of width booleans. */
  blocks: boolean[][];
  /** Filled letters, '' for black squares. */
  letters: string[][];
  slots: CrosswordFilledSlot[];
}

export interface CrosswordGenerationOptions {
  /** Grids are always square. */
  size: number;
  symmetry: CrosswordSymmetry;
  /** Shortest allowed run of letters. Shorter runs get blocked out. */
  minWordLength: number;
  /**
   * Share of entries that may be acronyms, e.g. 0.1 for 10%. Once the budget
   * is spent the solver blocks the grid instead of reaching for another one.
   */
  maxAcronymRatio: number;
  /**
   * Scryfall-style filter (e.g. `ci=g`, `t:elf`) whose card names fill the
   * full-length slots, giving the puzzle a theme. Blank disables theming.
   */
  themeFilterText?: string;
  /** Vocabulary classes usable at all. */
  allowedClasses: CrosswordEntryClass[];
  /** Classes tried first; others act as fallback. */
  preferredClasses: CrosswordEntryClass[];
  seed: string;
}

export const ALL_CROSSWORD_CLASSES: CrosswordEntryClass[] = [
  'cardName',
  'nameWord',
  'nameBigram',
  'acronym',
  'creatureType',
  'keyword',
  'legendName',
  'legendTitle',
  'setCode',
  'oracleWord',
];

/* ------------------------------------------------------------------ *
 * The daily game. Everything above is the generator; everything below
 * is one puzzle a day, played and timed.
 * ------------------------------------------------------------------ */

/**
 * One day's crossword, as stored. `grid` is the *solved* grid — letters and
 * entry texts included — so it never goes to a browser unfiltered. Serve it
 * through `toBoard` (serverutils/crossword/board.ts) instead.
 *
 * Clues are stored rather than re-derived per request: a published puzzle has to
 * read the same tomorrow, even if the clue writer has been changed underneath it.
 */
export interface CrosswordPuzzle extends BaseObject {
  id: string; // Puzzle date, YYYY-MM-DD (one puzzle per day)
  type: string; // Constant 'HISTORY' for GSI querying
  date: string; // Same as id; kept explicit for GSI sort keys
  grid: CrosswordPuzzleGrid;
  isActive: boolean; // Whether this is the current daily puzzle
}

export type NewCrosswordPuzzle = Omit<CrosswordPuzzle, 'id' | 'type' | 'dateCreated' | 'dateLastUpdated'>;

/** A slot as a solver may see it: where it is, its number, its clue. No answer. */
export interface CrosswordBoardSlot extends CrosswordSlot {
  clue: string;
}

/**
 * The puzzle as the client is allowed to see it: the shape of the grid, the clue
 * numbering and the clues. No letters, no entry texts — those are the answer,
 * and checking happens on the server.
 */
export interface CrosswordBoard {
  date: string;
  width: number;
  height: number;
  /** true = black square. Row-major, height rows of width booleans. */
  blocks: boolean[][];
  slots: CrosswordBoardSlot[];
}

/** One answer, revealed only once the solver has finished the puzzle. */
export interface CrosswordAnswer {
  id: string;
  number: number;
  direction: 'across' | 'down';
  /** The letters as they sit in the grid. */
  text: string;
  /** The readable form, e.g. "Thrun, the Last Troll". */
  display: string;
  entryClass: CrosswordEntryClass;
}

/**
 * A logged-in user's run at one puzzle. Created the moment they first open it,
 * because that is when the clock starts — `startedAt` is the server's, never the
 * client's, and `completionTimeMs` is derived from it.
 */
export interface CrosswordSubmission extends BaseObject {
  userId: string;
  date: string; // Puzzle date, YYYY-MM-DD
  /** Server clock start: when this user first opened this puzzle. */
  startedAt: number;
  /** Check and submit calls made. A submit is free; a check is not (see `checks`). */
  attempts: number;
  /** Times the solver asked which of their letters are wrong. */
  checks: number;
  /** Words revealed. */
  reveals: number;
  solved: boolean;
  /** Wall-clock milliseconds from `startedAt` to the solve. Absent until solved. */
  completionTimeMs?: number;
  completedAt?: number;
}

export type NewCrosswordSubmission = Omit<CrosswordSubmission, 'dateCreated' | 'dateLastUpdated'>;

/**
 * Aggregate per-user stats. Streaks only advance on the active day's puzzle, so
 * catching up on the archive can't build one.
 */
export interface CrosswordUserStats extends BaseObject {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate?: string; // YYYY-MM-DD of the last active-day attempt
  totalPlayed: number; // Days with at least one attempt
  totalSolved: number; // Days solved
  perfectDays: number; // Solved with no checks and no reveals
  /** Fastest solve so far, in milliseconds. */
  bestTimeMs?: number;
}

export type NewCrosswordUserStats = Omit<CrosswordUserStats, 'dateCreated' | 'dateLastUpdated'>;
