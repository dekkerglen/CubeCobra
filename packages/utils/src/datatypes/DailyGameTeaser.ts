/**
 * The dashboard's daily-game slot: one of the four dailies, chosen per viewer per day.
 *
 * Each variant carries exactly what its card renders and no more. In particular the
 * two games that hide something from their players — Synergy Connect's group
 * membership and the crossword's letters — are represented here by the same
 * withholding shapes their own pages are served (`SynergyConnectBoard`, and a
 * projection of `CrosswordBoard`), never by the stored puzzle.
 *
 * Only ever built for a game the viewer has *not* started, so there is no progress
 * to carry: every teaser is a fresh board.
 */
import Cube from './Cube';
import { DailyGameKey } from './DailyGameStats';
import { ManaMatrixPuzzle } from './ManaMatrix';
import { P1P1Pack } from './P1P1Pack';
import { SynergyConnectBoard } from './SynergyConnect';

/**
 * The crossword as a dashboard card may see it: where the black squares are, how big
 * the grid is, and how many clues it has. Derived from `CrosswordBoard`, so it cannot
 * reach a letter or an entry text; the clues are dropped as well, because the card
 * draws a grid rather than reading it out.
 */
export interface CrosswordShapeTeaser {
  date: string;
  width: number;
  height: number;
  /** true = black square. Row-major, `height` rows of `width` booleans. */
  blocks: boolean[][];
  clueCount: number;
}

export type DailyGameTeaser =
  | { game: Extract<DailyGameKey, 'dailyp1p1'>; pack: P1P1Pack; cube: Cube; date?: number }
  | { game: Extract<DailyGameKey, 'manamatrix'>; puzzle: ManaMatrixPuzzle }
  | { game: Extract<DailyGameKey, 'synergyconnect'>; board: SynergyConnectBoard }
  | { game: Extract<DailyGameKey, 'crossword'>; shape: CrosswordShapeTeaser };

/**
 * What the dashboard route hands the page.
 *
 * `teaser` null with `allPlayed` true means the viewer has started all of today's
 * puzzles; null with `allPlayed` false means there was nothing to offer (no active
 * puzzles, or a read failed). The two must stay distinguishable — congratulating
 * someone on a day with no games would be nonsense.
 */
export interface DailyGameTeaserResult {
  teaser: DailyGameTeaser | null;
  allPlayed: boolean;
}

/** Where each game is played, for the "you've played them all" links. */
export const DAILY_GAME_HREFS: Record<DailyGameKey, string> = {
  manamatrix: '/tool/manamatrix',
  synergyconnect: '/tool/synergyconnect',
  crossword: '/tool/crossword',
  dailyp1p1: '/tool/p1p1/daily',
};

export const DAILY_GAME_NAMES: Record<DailyGameKey, string> = {
  manamatrix: 'Mana Matrix',
  synergyconnect: 'Synergy Connect',
  crossword: 'Crossword',
  dailyp1p1: 'Daily P1P1',
};
