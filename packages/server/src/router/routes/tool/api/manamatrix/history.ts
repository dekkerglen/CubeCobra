import { manaMatrixPuzzleDao } from 'dynamo/daos';

import { Request, Response } from '../../../../../types/express';

/** Paginated puzzle archive, newest first. */
export const getManaMatrixHistoryHandler = async (req: Request, res: Response) => {
  try {
    const { lastKey } = req.query;
    const limit = 30;

    let parsedLastKey: Record<string, any> | undefined;
    if (lastKey) {
      try {
        parsedLastKey = JSON.parse(lastKey as string);
      } catch (_parseError) {
        req.logger.error('Invalid lastKey format:', lastKey);
        return res.status(400).json({ error: 'Invalid lastKey format' });
      }
    }

    const result = await manaMatrixPuzzleDao.getHistory(parsedLastKey, limit);

    return res.status(200).json({
      success: true,
      history: result.items,
      hasMore: !!result.lastKey,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching ManaMatrix history' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getManaMatrixHistoryHandler],
  },
];
