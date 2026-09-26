import {
  SYNERGY_CONNECT_MAX_MISTAKES,
  SynergyConnectPuzzle,
  SynergyConnectSubmission,
  SynergyConnectUserStats,
} from '@utils/datatypes/SynergyConnect';
import { synergyConnectPuzzleDao, synergyConnectSubmissionDao, synergyConnectUserStatsDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { bodyValidation, csrfProtection } from 'router/middleware';
import { evaluateGuess, isComplete, revealAll } from 'serverutils/synergyconnect/board';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { Request, Response } from '../../../../../types/express';

// Guesses are validated server-side, so the API is the only way to test a
// grouping — rate limit it to keep brute-forcing impractical.
const guessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

export const GuessSynergyConnectSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  // The four selected cards, by oracle id.
  cards: Joi.array().length(4).items(Joi.string().max(100)).required(),
});

const previousDay = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};

const gameOver = (submission: SynergyConnectSubmission): boolean =>
  isComplete(submission) || submission.mistakes >= SYNERGY_CONNECT_MAX_MISTAKES;

/**
 * Applies a completed game to the user's aggregate stats. Streaks only advance
 * on the active day's puzzle, and only once per day.
 */
const applyStats = async (
  userId: string,
  puzzle: SynergyConnectPuzzle,
  submission: SynergyConnectSubmission,
  newlySolved: number,
  justFinished: boolean,
  isFirstGuessToday: boolean,
): Promise<SynergyConnectUserStats> => {
  const existing = await synergyConnectUserStatsDao.getByUserId(userId);
  const stats: SynergyConnectUserStats = existing ?? {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedDate: undefined,
    totalPlayed: 0,
    totalSolved: 0,
    perfectDays: 0,
    dateCreated: Date.now(),
    dateLastUpdated: Date.now(),
  };

  if (isFirstGuessToday) {
    stats.totalPlayed += 1;
  }
  stats.totalSolved += newlySolved;
  if (justFinished && isComplete(submission) && submission.mistakes === 0) {
    stats.perfectDays += 1;
  }

  if (puzzle.isActive && isFirstGuessToday && stats.lastPlayedDate !== puzzle.date) {
    stats.currentStreak = stats.lastPlayedDate === previousDay(puzzle.date) ? stats.currentStreak + 1 : 1;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.lastPlayedDate = puzzle.date;
  }

  stats.dateLastUpdated = Date.now();
  if (existing) {
    await synergyConnectUserStatsDao.update(stats);
  } else {
    await synergyConnectUserStatsDao.createUserStats(stats);
  }
  return stats;
};

export const guessSynergyConnectHandler = async (req: Request, res: Response) => {
  try {
    const { date, cards } = req.body as { date: string; cards: string[] };

    const puzzle = await synergyConnectPuzzleDao.getByDate(date);
    if (!puzzle) {
      return res.status(404).json({ error: 'No Synergy Connect puzzle for that date' });
    }

    const result = evaluateGuess(puzzle, cards);
    if (!result) {
      return res.status(400).json({ error: 'Guess must be four distinct cards from this puzzle' });
    }

    // Anonymous play: judge the guess, persist nothing. The client owns the
    // running state (and can't cheat, since it never sees group membership).
    if (!req.user) {
      return res.status(200).json({
        success: true,
        correct: result.groupIndex !== null,
        group: result.groupIndex !== null ? puzzle.groups[result.groupIndex] : null,
        groupIndex: result.groupIndex,
        guessGroups: result.guessGroups,
        oneAway: result.oneAway,
        stats: null,
      });
    }

    const existing = await synergyConnectSubmissionDao.getByUserAndDate(req.user.id, date);
    if (existing && gameOver(existing)) {
      return res.status(409).json({ error: "Today's game is already over", submission: existing });
    }

    // Re-solving an already-solved group is a no-op rather than a mistake.
    const alreadySolved = new Set(existing?.solvedGroups ?? []);
    if (result.groupIndex !== null && alreadySolved.has(result.groupIndex)) {
      return res.status(200).json({
        success: true,
        correct: true,
        group: puzzle.groups[result.groupIndex],
        groupIndex: result.groupIndex,
        guessGroups: result.guessGroups,
        oneAway: false,
        submission: existing,
        stats: null,
      });
    }

    const correct = result.groupIndex !== null;
    const solvedGroups = correct
      ? [...(existing?.solvedGroups ?? []), result.groupIndex!]
      : (existing?.solvedGroups ?? []);
    const mistakes = (existing?.mistakes ?? 0) + (correct ? 0 : 1);
    const guesses = [...(existing?.guesses ?? []), result.guessGroups];

    const nowComplete = solvedGroups.length >= 4;
    const nowFinished = nowComplete || mistakes >= SYNERGY_CONNECT_MAX_MISTAKES;

    let submission: SynergyConnectSubmission;
    if (existing) {
      submission = {
        ...existing,
        solvedGroups,
        guesses,
        mistakes,
        completedAt: nowComplete && !existing.completedAt ? Date.now() : existing.completedAt,
        dateLastUpdated: Date.now(),
      };
      await synergyConnectSubmissionDao.update(submission);
    } else {
      submission = await synergyConnectSubmissionDao.createSubmission({
        userId: req.user.id,
        date,
        solvedGroups,
        guesses,
        mistakes,
        completedAt: nowComplete ? Date.now() : undefined,
      });
    }

    const stats = await applyStats(req.user.id, puzzle, submission, correct ? 1 : 0, nowFinished, !existing);

    return res.status(200).json({
      success: true,
      correct,
      group: correct ? puzzle.groups[result.groupIndex!] : null,
      groupIndex: result.groupIndex,
      guessGroups: result.guessGroups,
      oneAway: result.oneAway,
      submission,
      // Out of lives: reveal the board so the player can see the answers.
      revealed: nowFinished && !nowComplete ? revealAll(puzzle) : null,
      stats,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error submitting guess' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [guessLimiter, csrfProtection, bodyValidation(GuessSynergyConnectSchema), guessSynergyConnectHandler],
  },
];
