import { manaMatrixPuzzleDao } from 'dynamo/daos';

import { Request, Response } from '../../../../../types/express';

/** A puzzle by date, for archive play. */
export const getManaMatrixPuzzleHandler = async (req: Request, res: Response) => {
  try {
    const puzzle = await manaMatrixPuzzleDao.getByDate(req.params.date!);
    if (!puzzle) {
      return res.status(404).json({ error: 'No Mana Matrix puzzle for that date' });
    }

    return res.status(200).json({ success: true, puzzle });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching Mana Matrix puzzle' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [getManaMatrixPuzzleHandler],
  },
];
