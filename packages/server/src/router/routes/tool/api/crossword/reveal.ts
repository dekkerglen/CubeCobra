import { crosswordPuzzleDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureAuthJson } from 'router/middleware';
import { revealWord } from 'serverutils/crossword/board';
import { recordAction, startSession } from 'serverutils/crossword/daily';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { Request, Response } from '../../../../../types/express';

const revealLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

export const RevealCrosswordSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  // The slot to give up on, by the id the board carries.
  slotId: Joi.string().max(64).required(),
});

/**
 * Hands over one word's letters.
 *
 * Logged in only — and not for the streak's sake. Slot ids are public, so an
 * endpoint that returns letters to anyone would be a way to read the whole
 * solution one word at a time. Requiring a session means every reveal lands on a
 * run: it shows up in that player's `reveals` count and it costs them the day's
 * perfect. Same reasoning as Synergy Connect, where an anonymous loss doesn't get
 * the answers either.
 */
export const revealCrosswordHandler = async (req: Request, res: Response) => {
  try {
    // ensureAuthJson guarantees user exists but we're doing this for typescript
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { date, slotId } = req.body as { date: string; slotId: string };

    const puzzle = await crosswordPuzzleDao.getByDate(date);
    if (!puzzle) {
      return res.status(404).json({ error: 'No crossword puzzle for that date' });
    }

    const revealed = revealWord(puzzle.grid, slotId);
    if (!revealed) {
      return res.status(400).json({ error: 'No such clue in this puzzle' });
    }

    const session = await startSession(req.user.id, date);
    // A reveal never completes a puzzle on its own: the client writes the letters
    // in and the resulting full grid goes to `submit`.
    const { submission, stats } = await recordAction(puzzle, session, 'reveal', false);

    return res.status(200).json({ success: true, revealed, submission, stats });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error revealing word' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [
      revealLimiter,
      ensureAuthJson,
      csrfProtection,
      bodyValidation(RevealCrosswordSchema),
      revealCrosswordHandler,
    ],
  },
];
