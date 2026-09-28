import { CrosswordPuzzle } from '@utils/datatypes/Crossword';
import { crosswordPuzzleDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation } from 'router/middleware';
import { whenCardDbReady } from 'serverutils/cardCatalog';
import { buildDailyGrid, isBuildFailure } from 'serverutils/crossword/puzzle';

import { Request, Response } from '../../../../../types/express';

export const RotateCrosswordSchema = Joi.object({
  apiKey: Joi.string().required(),
  // Optional override for backfills / manual reruns; defaults to the current puzzle day.
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * The puzzle day for a rotation happening now. Add 6 hours so the lambda
 * firing just after 00:00 UTC lands on the date most users consider "today"
 * (same convention as the other daily rotations).
 */
const targetDateString = (): string => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * What the response says about a rotated puzzle. The other games hand back the
 * whole puzzle here; a crossword puzzle *is* its answer key, so this returns the
 * shape and nothing else — the caller is a lambda that logs the date, and an HTTP
 * response is a worse place for a solution than Dynamo is.
 */
const summarize = (puzzle: CrosswordPuzzle) => ({
  date: puzzle.date,
  isActive: puzzle.isActive,
  width: puzzle.grid.width,
  height: puzzle.grid.height,
  slots: puzzle.grid.slots.length,
});

/**
 * Machine-to-machine endpoint called by the daily jobs lambda. Generation needs
 * the memory-resident card catalog and the crossword vocabulary, neither of which
 * the lambda loads, so the lambda delegates here. Idempotent: re-running for a
 * date that already has a puzzle returns it unchanged.
 *
 * Reuses MANAMATRIX_API_KEY, the shared key for the daily game rotations, so
 * shipping this needs no new secret and no pipeline change.
 */
export const rotateCrosswordHandler = async (req: Request, res: Response) => {
  const apiKey = process.env.MANAMATRIX_API_KEY;
  if (!apiKey || req.body.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const date: string = req.body.date || targetDateString();

    const existing = await crosswordPuzzleDao.getByDate(date);
    if (existing) {
      return res.status(200).json({ success: true, puzzle: summarize(existing), alreadyExisted: true });
    }

    await whenCardDbReady();
    const grid = await buildDailyGrid(date);
    if (isBuildFailure(grid)) {
      return res.status(500).json({ error: `Could not generate a crossword for ${date}: ${grid.reason}` });
    }

    const puzzle = await crosswordPuzzleDao.setActivePuzzle({ date, grid, isActive: true });

    return res.status(200).json({ success: true, puzzle: summarize(puzzle) });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error rotating crossword puzzle' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [bodyValidation(RotateCrosswordSchema), rotateCrosswordHandler],
  },
];
