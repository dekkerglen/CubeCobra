import { synergyConnectPuzzleDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation } from 'router/middleware';
import { whenCardDbReady } from 'serverutils/cardCatalog';
import { generatePuzzle } from 'serverutils/synergyconnect/generate';

import { Request, Response } from '../../../../../types/express';

export const RotateSynergyConnectSchema = Joi.object({
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
 * Machine-to-machine endpoint called by the daily jobs lambda. Generation needs
 * the memory-resident card catalog and synergy metadata, which only the server
 * has. Idempotent: re-running for a date that already has a puzzle returns it.
 */
export const rotateSynergyConnectHandler = async (req: Request, res: Response) => {
  const apiKey = process.env.MANAMATRIX_API_KEY;
  if (!apiKey || req.body.apiKey !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const date: string = req.body.date || targetDateString();

    const existing = await synergyConnectPuzzleDao.getByDate(date);
    if (existing) {
      return res.status(200).json({ success: true, puzzle: existing, alreadyExisted: true });
    }

    await whenCardDbReady();
    const generated = generatePuzzle(date);

    const puzzle = await synergyConnectPuzzleDao.setActivePuzzle({
      date,
      theme: generated.theme,
      groups: generated.groups,
      order: generated.order,
      isActive: true,
    });

    return res.status(200).json({ success: true, puzzle });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error rotating Synergy Connect puzzle' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [bodyValidation(RotateSynergyConnectSchema), rotateSynergyConnectHandler],
  },
];
