import { ManaMatrixPuzzle, ManaMatrixSubmission, ManaMatrixUserStats } from '@utils/datatypes/ManaMatrix';
import {
  manaMatrixCellStatsDao,
  manaMatrixPuzzleDao,
  manaMatrixSubmissionDao,
  manaMatrixUserStatsDao,
} from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { bodyValidation, csrfProtection } from 'router/middleware';
import { whenCardDbReady } from 'serverutils/cardCatalog';
import { popularityGrid } from 'serverutils/manamatrix/popularity';
import { validateAnswers } from 'serverutils/manamatrix/validate';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { Request, Response } from '../../../../../types/express';

// Answers are validated server-side, so the API is the only way to test a
// guess — rate limit it to keep brute-forcing cells impractical.
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

export const SubmitManaMatrixSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  answers: Joi.array()
    .length(3)
    .items(Joi.array().length(3).items(Joi.string().allow('', null).max(200)))
    .required(),
});

const previousDay = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
};

const countTrue = (grid: boolean[][]): number => grid.flat().filter(Boolean).length;

interface LoggedInResult {
  submission: ManaMatrixSubmission;
  stats: ManaMatrixUserStats;
  popularityNames: (string | null)[][];
}

const applyLoggedInSubmission = async (
  userId: string,
  puzzle: ManaMatrixPuzzle,
  answers: (string | null)[][],
  correct: boolean[][],
  matchedNames: (string | null)[][],
  displayNames: (string | null)[][],
): Promise<LoggedInResult> => {
  const existing = await manaMatrixSubmissionDao.getByUserAndDate(userId, puzzle.date);

  // Merge with prior attempts: a cell that was ever correct stays correct
  // (with the answer that solved it), so retrying never loses progress.
  const mergedCorrect: boolean[][] = Array.from({ length: 3 }, () => [false, false, false]);
  const mergedAnswers: (string | null)[][] = Array.from({ length: 3 }, () => [null, null, null]);
  const countedCells: Record<string, string> = { ...existing?.countedCells };
  const popularityNames: (string | null)[][] = Array.from({ length: 3 }, () => [null, null, null]);

  let newlyCorrect = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cellKey = `${row},${col}`;
      const wasCorrect = existing?.correct?.[row]?.[col] ?? false;
      const isCorrect = correct[row]![col]!;

      if (wasCorrect) {
        mergedCorrect[row]![col] = true;
        mergedAnswers[row]![col] = existing?.answers?.[row]?.[col] ?? null;
        popularityNames[row]![col] = countedCells[cellKey] ?? null;
        continue;
      }

      mergedCorrect[row]![col] = isCorrect;
      // Store the canonical printed name for solved cells, the raw input otherwise.
      mergedAnswers[row]![col] = (isCorrect ? displayNames[row]![col] : null) ?? answers[row]?.[col] ?? null;

      if (isCorrect) {
        const name = matchedNames[row]![col]!;
        popularityNames[row]![col] = name;
        newlyCorrect += 1;
        if (!countedCells[cellKey]) {
          // Count each user's answer for a cell exactly once, on the attempt
          // that first solved it.
          await manaMatrixCellStatsDao.recordAnswer(puzzle.date, row, col, name);
          countedCells[cellKey] = name;
        }
      }
    }
  }

  const isFirstSubmissionForDate = !existing;
  const justCompleted = !existing?.completedAt && countTrue(mergedCorrect) === 9;

  let submission: ManaMatrixSubmission;
  if (existing) {
    submission = {
      ...existing,
      answers: mergedAnswers,
      correct: mergedCorrect,
      attempts: existing.attempts + 1,
      countedCells,
      completedAt: justCompleted ? Date.now() : existing.completedAt,
      dateLastUpdated: Date.now(),
    };
    await manaMatrixSubmissionDao.update(submission);
  } else {
    submission = await manaMatrixSubmissionDao.createSubmission({
      userId,
      date: puzzle.date,
      answers: mergedAnswers,
      correct: mergedCorrect,
      attempts: 1,
      countedCells,
      completedAt: justCompleted ? Date.now() : undefined,
    });
  }

  // Aggregate stats: totals move on any puzzle, the streak only on the first
  // submission for the currently active day.
  const existingStats = await manaMatrixUserStatsDao.getByUserId(userId);
  const stats: ManaMatrixUserStats = existingStats ?? {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastPlayedDate: undefined,
    totalPlayed: 0,
    totalCellsCorrect: 0,
    perfectDays: 0,
    dateCreated: Date.now(),
    dateLastUpdated: Date.now(),
  };

  if (isFirstSubmissionForDate) {
    stats.totalPlayed += 1;
  }
  stats.totalCellsCorrect += newlyCorrect;
  if (justCompleted) {
    stats.perfectDays += 1;
  }

  if (puzzle.isActive && isFirstSubmissionForDate && stats.lastPlayedDate !== puzzle.date) {
    stats.currentStreak = stats.lastPlayedDate === previousDay(puzzle.date) ? stats.currentStreak + 1 : 1;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.lastPlayedDate = puzzle.date;
  }

  stats.dateLastUpdated = Date.now();
  if (existingStats) {
    await manaMatrixUserStatsDao.update(stats);
  } else {
    await manaMatrixUserStatsDao.createUserStats(stats);
  }

  return { submission, stats, popularityNames };
};

export const submitManaMatrixHandler = async (req: Request, res: Response) => {
  try {
    const { date, answers } = req.body as { date: string; answers: (string | null)[][] };

    const puzzle = await manaMatrixPuzzleDao.getByDate(date);
    if (!puzzle) {
      return res.status(404).json({ error: 'No ManaMatrix puzzle for that date' });
    }

    await whenCardDbReady();
    const { correct, matchedNames, displayNames } = validateAnswers(puzzle, answers);

    if (!req.user) {
      // Anonymous play: validate and show popularity context, persist nothing.
      const cellStats = await manaMatrixCellStatsDao.getForPuzzle(puzzle.date);
      const canonicalAnswers = answers.map((row, r) =>
        row.map((value, c) => (correct[r]![c] ? (displayNames[r]![c] ?? value) : value)),
      );
      return res.status(200).json({
        success: true,
        correct,
        answers: canonicalAnswers,
        attempts: null,
        popularity: popularityGrid(cellStats, matchedNames),
        stats: null,
      });
    }

    const { submission, stats, popularityNames } = await applyLoggedInSubmission(
      req.user.id,
      puzzle,
      answers,
      correct,
      matchedNames,
      displayNames,
    );

    const cellStats = await manaMatrixCellStatsDao.getForPuzzle(puzzle.date);
    return res.status(200).json({
      success: true,
      correct: submission.correct,
      answers: submission.answers,
      attempts: submission.attempts,
      popularity: popularityGrid(cellStats, popularityNames),
      stats,
      completedAt: submission.completedAt ?? null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error submitting ManaMatrix answers' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [submitLimiter, csrfProtection, bodyValidation(SubmitManaMatrixSchema), submitManaMatrixHandler],
  },
];
