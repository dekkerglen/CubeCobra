// Classifies daily-game submissions into started / partially completed / finished, and rolls
// a day's submissions up into the numbers the admin dashboard plots.
//
// Everything here is pure: the callers (router/routes/admin/dailygames.ts) fetch, this
// module counts. Each game's finish condition is read off the fields it actually records
// rather than a shared notion of "done", because the three games disagree about what done is.
import { CrosswordSubmission } from '@utils/datatypes/Crossword';
import { DailyGameDayStats } from '@utils/datatypes/DailyGameStats';
import { ManaMatrixSubmission } from '@utils/datatypes/ManaMatrix';
import { SYNERGY_CONNECT_MAX_MISTAKES, SynergyConnectSubmission } from '@utils/datatypes/SynergyConnect';

/** The three states the dashboard plots. `started` is every row, so it is the sum of the others. */
export type FunnelState = 'partial' | 'finished';

/** Anything keyed per user per puzzle date, which is all four games' submissions. */
interface PerUserPerDay {
  userId: string;
  dateLastUpdated?: number;
}

const ALL_NINE = 9;

const countTrue = (grid: boolean[][] | undefined): number =>
  (grid ?? []).reduce((sum, row) => sum + (row ?? []).filter(Boolean).length, 0);

/**
 * ManaMatrix: finished is all nine cells correct.
 *
 * `completedAt` is the field the submit route sets when the ninth cell lands, and `correct`
 * is the grid it derived that from; either being conclusive is enough, so a row that somehow
 * has one without the other still reads as finished rather than silently as partial.
 *
 * There is no `startedAt` on this item — the row is only created by the first submit — so a
 * player who opened the puzzle and never guessed is invisible, and every row here has at
 * least one attempt.
 */
export const classifyManaMatrix = (submission: ManaMatrixSubmission): FunnelState =>
  submission.completedAt !== undefined || countTrue(submission.correct) === ALL_NINE ? 'finished' : 'partial';

/**
 * Crossword: finished is `solved`.
 *
 * Unlike the other two, this row is created when the player first *opens* the puzzle, because
 * that is when the clock starts. So a Crossword "started" means opened, not attempted, and
 * `isCrosswordEngaged` separates the two.
 */
export const classifyCrossword = (submission: CrosswordSubmission): FunnelState =>
  submission.solved ? 'finished' : 'partial';

/** A Crossword player who did something: submitted, checked, or revealed. */
export const isCrosswordEngaged = (submission: CrosswordSubmission): boolean =>
  (submission.attempts ?? 0) > 0 || (submission.checks ?? 0) > 0 || (submission.reveals ?? 0) > 0;

/**
 * Synergy Connect: finished is all four groups solved.
 *
 * Keyed on `solvedGroups` rather than `completedAt` because the guess route only sets
 * `completedAt` on a full solve — a player who burns all four mistakes is just as done, but
 * has no timestamp. Those players are counted separately by `isSynergyExhausted`; they sit
 * inside `partial`, since they did not finish.
 */
export const classifySynergyConnect = (submission: SynergyConnectSubmission): FunnelState =>
  (submission.solvedGroups?.length ?? 0) >= 4 ? 'finished' : 'partial';

/** A Synergy Connect player the game locked out: four mistakes, four groups never found. */
export const isSynergyExhausted = (submission: SynergyConnectSubmission): boolean =>
  (submission.mistakes ?? 0) >= SYNERGY_CONNECT_MAX_MISTAKES && classifySynergyConnect(submission) !== 'finished';

/**
 * Collapses a day's rows to one per player.
 *
 * The DAOs key one row per user per date and increment attempts in place, so a player with
 * twenty attempts is already one row. This exists so that *is* guaranteed at the counting
 * layer too — a caller that concatenates overlapping pages, or a future writer that stops
 * being careful, must not be able to turn one player into several.
 *
 * When the same player does appear twice, the more progressed row wins (finished over not,
 * then the more recently updated), so a duplicate can only ever under-report progress by
 * being discarded, never invent it.
 */
export const dedupeByPlayer = <T extends PerUserPerDay>(
  submissions: T[],
  classify: (submission: T) => FunnelState,
): T[] => {
  const byUser = new Map<string, T>();

  for (const submission of submissions) {
    const existing = byUser.get(submission.userId);
    if (!existing) {
      byUser.set(submission.userId, submission);
      continue;
    }

    const existingFinished = classify(existing) === 'finished';
    const candidateFinished = classify(submission) === 'finished';
    if (candidateFinished && !existingFinished) {
      byUser.set(submission.userId, submission);
    } else if (candidateFinished === existingFinished) {
      if ((submission.dateLastUpdated ?? 0) > (existing.dateLastUpdated ?? 0)) {
        byUser.set(submission.userId, submission);
      }
    }
  }

  return [...byUser.values()];
};

/** Median of a numeric sample. Even counts average the two middle values. undefined if empty. */
export const median = (values: number[]): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const rate = (finished: number, started: number): number | null => (started === 0 ? null : finished / started);

/**
 * Rolls one puzzle date up into its funnel. Pass every row for that date; the player-level
 * dedupe happens here.
 */
const summarize = <T extends PerUserPerDay>(
  date: string,
  submissions: T[],
  classify: (submission: T) => FunnelState,
): { counts: DailyGameDayStats; players: T[] } => {
  const players = dedupeByPlayer(submissions, classify);
  const finished = players.filter((submission) => classify(submission) === 'finished').length;

  return {
    counts: {
      date,
      started: players.length,
      partial: players.length - finished,
      finished,
      completionRate: rate(finished, players.length),
    },
    players,
  };
};

export const summarizeManaMatrixDay = (date: string, submissions: ManaMatrixSubmission[]): DailyGameDayStats =>
  summarize(date, submissions, classifyManaMatrix).counts;

export const summarizeSynergyConnectDay = (
  date: string,
  submissions: SynergyConnectSubmission[],
): DailyGameDayStats => {
  const { counts, players } = summarize(date, submissions, classifySynergyConnect);
  return { ...counts, exhausted: players.filter(isSynergyExhausted).length };
};

export const summarizeCrosswordDay = (date: string, submissions: CrosswordSubmission[]): DailyGameDayStats => {
  const { counts, players } = summarize(date, submissions, classifyCrossword);

  // Only solved runs carry a completionTimeMs, and it is what the game scores itself on.
  const times = players
    .filter((submission) => submission.solved && typeof submission.completionTimeMs === 'number')
    .map((submission) => submission.completionTimeMs!);

  return {
    ...counts,
    engaged: players.filter(isCrosswordEngaged).length,
    medianCompletionTimeMs: median(times) ?? null,
  };
};

/**
 * Daily P1P1 has no funnel: a vote is one click, so a player has either voted or not.
 * `started` and `finished` are both the distinct voter count and `partial` is always zero,
 * which the UI reads via `hasFunnel: false` and renders as a participation count.
 */
export const summarizeDailyP1P1Day = (date: string, voterIds: string[]): DailyGameDayStats => {
  const voters = new Set(voterIds).size;
  return { date, started: voters, partial: 0, finished: voters, completionRate: rate(voters, voters) };
};

/** An empty day, so a range with no play still plots a point at zero rather than a gap. */
export const emptyDay = (date: string, extras: Partial<DailyGameDayStats> = {}): DailyGameDayStats => ({
  date,
  started: 0,
  partial: 0,
  finished: 0,
  completionRate: null,
  ...extras,
});

/** Inclusive list of YYYY-MM-DD dates from start to end. Empty if end precedes start. */
export const datesBetween = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return dates;
  }

  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
};
