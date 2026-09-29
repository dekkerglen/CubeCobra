/**
 * Shapes for the admin daily-games funnel dashboard (/admin/dailygames).
 *
 * Two different populations are described here and they must not be conflated:
 *
 *  - `DailyGameDayStats` is derived from persisted submissions, so it counts
 *    **logged-in players only**. ManaMatrix, Synergy Connect and the Crossword all
 *    allow anonymous play and persist nothing for it.
 *  - `DailyGamePageHits` is derived from the server's request log, so it counts
 *    **every request** — logged in, anonymous, and bots, which nothing filters.
 *
 * They are also bucketed on different axes: submissions by *puzzle date*, page hits
 * by *the UTC day the request happened*. Those coincide for same-day play (the
 * overwhelming majority) but diverge for someone catching up on the archive.
 */

export type DailyGameKey = 'manamatrix' | 'synergyconnect' | 'crossword' | 'dailyp1p1';

export const DAILY_GAME_KEYS: DailyGameKey[] = ['manamatrix', 'synergyconnect', 'crossword', 'dailyp1p1'];

/** One puzzle date's funnel for one game, from persisted submissions. */
export interface DailyGameDayStats {
  /** Puzzle date, YYYY-MM-DD. */
  date: string;
  /** Distinct logged-in players with a persisted row for this puzzle. */
  started: number;
  /** Started but never reached the game's finish state. */
  partial: number;
  /** Reached the game's own finish state (see the per-game classifiers). */
  finished: number;
  /** finished / started. null when nobody started, so the UI can draw a gap, not a zero. */
  completionRate: number | null;
  /**
   * Median wall-clock solve time of the players who finished, in ms. Crossword only —
   * it is the only game that records a duration. Absent elsewhere, null if nobody finished.
   */
  medianCompletionTimeMs?: number | null;
  /**
   * Crossword only: of the players who started (opened the puzzle), how many ever
   * touched it. The Crossword is the one game whose row is created on open rather
   * than on first guess, so it is the only one that can tell the two apart.
   */
  engaged?: number;
  /**
   * Synergy Connect only: players the game locked out after four mistakes. A subset
   * of `partial` — they are done, but they did not finish.
   */
  exhausted?: number;
}

/** One UTC day's request volume on a game's active-puzzle page, from the request log. */
export interface DailyGamePageHits {
  /** UTC day the requests happened, YYYY-MM-DD. */
  date: string;
  /** All requests, including bots. */
  hits: number;
  /** Distinct logged-in users among those requests. */
  loggedInUsers: number;
}

export interface DailyGameSeries {
  game: DailyGameKey;
  label: string;
  /** The route whose hits `pageHits` counts, for display. */
  pageRoute: string;
  /** Ascending by date, one entry per day in the requested range (zero-filled). */
  days: DailyGameDayStats[];
  /**
   * Ascending by date, or null when the request log could not be read (no AWS
   * credentials locally, log group missing, Insights query failed). Never silently
   * zero — a missing series and an empty one mean different things.
   */
  pageHits: DailyGamePageHits[] | null;
  pageHitsError?: string;
  /**
   * False for games with no meaningful funnel (Daily P1P1 is one click), so the UI
   * renders a participation count instead of a started/partial/finished split.
   */
  hasFunnel: boolean;
  /** Caveats specific to this game, rendered next to its charts. */
  notes: string[];
}

export interface DailyGameStatsResponse {
  startDate: string;
  endDate: string;
  series: DailyGameSeries[];
}
