import { manaMatrixPuzzleDao } from 'dynamo/daos';

import { Request, Response } from '../../../../../types/express';

/**
 * The active daily puzzle. Puzzles only contain the category filters, their
 * readable descriptions, and answer counts — never the answers themselves.
 */
export const getActiveManaMatrixHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await manaMatrixPuzzleDao.getActive();
    if (!puzzle) {
      return res.status(404).json({ error: 'No active Mana Matrix puzzle' });
    }

    return res.status(200).json({ success: true, puzzle });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching active Mana Matrix puzzle' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getActiveManaMatrixHandler],
  },
];
