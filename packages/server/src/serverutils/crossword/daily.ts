import { CrosswordPuzzle, CrosswordSubmission, CrosswordUserStats } from '@utils/datatypes/Crossword';
import { crosswordSubmissionDao, crosswordUserStatsDao } from 'dynamo/daos';

/**
 * The daily crossword's scorekeeping: when the clock starts, what an action costs,
 * and how a solve moves the streak.
 *
 * Completion time is the metric, so the clock is the server's alone. `startedAt`
 * is written the first time a logged-in player opens a puzzle and never again;
 * `completionTimeMs` is derived from it at the moment the server itself decides
 * the grid is correct. A client-supplied duration is never read.
 */

const previousDay = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};

/**
 * The player's run at this puzzle, starting the clock if this is their first look
 * at it. Logged-in players only: anonymous play is validated but never persisted,
 * so an anonymous run has no server clock and no recorded result.
 */
export const startSession = async (userId: string, date: string): Promise<CrosswordSubmission> => {
  const existing = await crosswordSubmissionDao.getByUserAndDate(userId, date);
  if (existing) {
    return existing;
  }

  return crosswordSubmissionDao.createSubmission({
    userId,
    date,
    startedAt: Date.now(),
    attempts: 0,
    checks: 0,
    reveals: 0,
    solved: false,
  });
};

/** What the player just did. A check costs a check; a submit is free. */
export type CrosswordAction = 'check' | 'reveal' | 'submit';

/** Whether the player has done anything on this puzzle yet. */
const hasActed = (submission: CrosswordSubmission): boolean => submission.attempts > 0 || submission.reveals > 0;

/**
 * Folds a finished run into the user's aggregate stats. Totals move on any
 * puzzle; the streak only on the active day's, and only once, so working through
 * the archive can't build one (the ManaMatrix rule).
 */
const applyStats = async (
  userId: string,
  puzzle: CrosswordPuzzle,
  submission: CrosswordSubmission,
  isFirstAction: boolean,
  justSolved: boolean,
): Promise<CrosswordUserStats> => {
  const existing = await crosswordUserStatsDao.getByUserId(userId);
  const stats: CrosswordUserStats = existing ?? {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedDate: undefined,
    totalPlayed: 0,
    totalSolved: 0,
    perfectDays: 0,
    bestTimeMs: undefined,
    dateCreated: Date.now(),
    dateLastUpdated: Date.now(),
  };

  if (isFirstAction) {
    stats.totalPlayed += 1;
  }

  if (justSolved) {
    stats.totalSolved += 1;
    // Unaided: no checks, no reveals.
    if (submission.checks === 0 && submission.reveals === 0) {
      stats.perfectDays += 1;
    }
    const time = submission.completionTimeMs;
    if (time !== undefined && (stats.bestTimeMs === undefined || time < stats.bestTimeMs)) {
      stats.bestTimeMs = time;
    }
  }

  if (puzzle.isActive && isFirstAction && stats.lastPlayedDate !== puzzle.date) {
    stats.currentStreak = stats.lastPlayedDate === previousDay(puzzle.date) ? stats.currentStreak + 1 : 1;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.lastPlayedDate = puzzle.date;
  }

  stats.dateLastUpdated = Date.now();
  if (existing) {
    await crosswordUserStatsDao.update(stats);
  } else {
    await crosswordUserStatsDao.createUserStats(stats);
  }
  return stats;
};

export interface ActionResult {
  submission: CrosswordSubmission;
  stats: CrosswordUserStats;
  /** True on the attempt that solved it, so the caller knows to celebrate once. */
  justSolved: boolean;
}

/**
 * Records one action against a run and returns the updated submission and stats.
 * `solved` is the server's verdict on the grid, not the client's claim.
 */
export const recordAction = async (
  puzzle: CrosswordPuzzle,
  existing: CrosswordSubmission,
  action: CrosswordAction,
  solved: boolean,
): Promise<ActionResult> => {
  const now = Date.now();
  const isFirstAction = !hasActed(existing);
  const justSolved = solved && !existing.solved;

  const submission: CrosswordSubmission = {
    ...existing,
    attempts: existing.attempts + (action === 'reveal' ? 0 : 1),
    checks: existing.checks + (action === 'check' ? 1 : 0),
    reveals: existing.reveals + (action === 'reveal' ? 1 : 0),
    solved: existing.solved || solved,
    // Timed off the stored start, so a slow client or a doctored payload can't
    // shorten a run.
    completionTimeMs: justSolved ? Math.max(0, now - existing.startedAt) : existing.completionTimeMs,
    completedAt: justSolved ? now : existing.completedAt,
    dateLastUpdated: now,
  };

  await crosswordSubmissionDao.update(submission);
  const stats = await applyStats(existing.userId, puzzle, submission, isFirstAction, justSolved);

  return { submission, stats, justSolved };
};
