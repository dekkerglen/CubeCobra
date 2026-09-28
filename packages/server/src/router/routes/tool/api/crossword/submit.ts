import { crosswordPuzzleDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { bodyValidation, csrfProtection } from 'router/middleware';
import { answerKey, isSolved } from 'serverutils/crossword/board';
import { recordAction, startSession } from 'serverutils/crossword/daily';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { Request, Response } from '../../../../../types/express';

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

export const SubmitCrosswordSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  letters: Joi.array()
    .max(32)
    .items(Joi.array().max(32).items(Joi.string().allow('').max(2)))
    .required(),
});

/**
 * "Am I done?" — answered yes or no, with nothing said about which letters are
 * wrong. The client calls it on its own when the grid fills up, so finishing
 * cleanly costs the solver nothing; the `check` endpoint is the one with a price.
 */
export const submitCrosswordHandler = async (req: Request, res: Response) => {
  try {
    const { date, letters } = req.body as { date: string; letters: string[][] };

    const puzzle = await crosswordPuzzleDao.getByDate(date);
    if (!puzzle) {
      return res.status(404).json({ error: 'No crossword puzzle for that date' });
    }

    const solved = isSolved(puzzle.grid, letters);

    // Anonymous play: judged, never stored.
    if (!req.user) {
      return res.status(200).json({
        success: true,
        solved,
        answers: solved ? answerKey(puzzle) : null,
        submission: null,
        stats: null,
      });
    }

    const session = await startSession(req.user.id, date);
    const { submission, stats } = await recordAction(puzzle, session, 'submit', solved);

    return res.status(200).json({
      success: true,
      solved,
      answers: submission.solved ? answerKey(puzzle) : null,
      submission,
      stats,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error submitting crossword' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [submitLimiter, csrfProtection, bodyValidation(SubmitCrosswordSchema), submitCrosswordHandler],
  },
];
