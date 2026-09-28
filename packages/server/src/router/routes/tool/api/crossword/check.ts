import { crosswordPuzzleDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { bodyValidation, csrfProtection } from 'router/middleware';
import { answerKey, checkLetters } from 'serverutils/crossword/board';
import { recordAction, startSession } from 'serverutils/crossword/daily';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { Request, Response } from '../../../../../types/express';

/**
 * Checking is the only feedback channel about the answers, so it is the one worth
 * rate limiting: with enough calls, "which of my letters are wrong" is a way to
 * read the grid a letter of the alphabet at a time. The limit makes that slow, the
 * recorded `checks` count makes it visible, and completion time — the game's
 * metric — makes it pointless.
 */
const checkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

/** A solver's grid: one letter (or blank) per cell, row-major. */
const lettersSchema = Joi.array()
  .max(32)
  .items(Joi.array().max(32).items(Joi.string().allow('').max(2)))
  .required();

export const CheckCrosswordSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  letters: lettersSchema,
});

export const checkCrosswordHandler = async (req: Request, res: Response) => {
  try {
    const { date, letters } = req.body as { date: string; letters: string[][] };

    const puzzle = await crosswordPuzzleDao.getByDate(date);
    if (!puzzle) {
      return res.status(404).json({ error: 'No crossword puzzle for that date' });
    }

    const result = checkLetters(puzzle.grid, letters);

    // Anonymous play: grade the grid, persist nothing. There is no server clock
    // for an anonymous run, so there is no completion time to record either.
    if (!req.user) {
      return res.status(200).json({
        success: true,
        wrong: result.wrong,
        blank: result.blank,
        solved: result.solved,
        answers: result.solved ? answerKey(puzzle) : null,
        submission: null,
        stats: null,
      });
    }

    const session = await startSession(req.user.id, date);
    const { submission, stats } = await recordAction(puzzle, session, 'check', result.solved);

    return res.status(200).json({
      success: true,
      wrong: result.wrong,
      blank: result.blank,
      solved: result.solved,
      // Solved means the answers are no longer a secret, so the finished grid can
      // show what each entry was.
      answers: submission.solved ? answerKey(puzzle) : null,
      submission,
      stats,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error checking crossword' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [checkLimiter, csrfProtection, bodyValidation(CheckCrosswordSchema), checkCrosswordHandler],
  },
];
