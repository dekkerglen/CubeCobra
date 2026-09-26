import { synergyConnectPuzzleDao } from 'dynamo/daos';

import { Request, Response } from '../../../../../types/express';

/**
 * Paginated puzzle archive, newest first. Only dates and themes — the groups
 * stay server-side so past puzzles remain playable.
 */
export const getSynergyConnectHistoryHandler = async (req: Request, res: Response) => {
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

    const result = await synergyConnectPuzzleDao.getHistory(parsedLastKey, limit);

    return res.status(200).json({
      success: true,
      history: result.items.map((puzzle) => ({ date: puzzle.date, theme: puzzle.theme })),
      hasMore: !!result.lastKey,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching Synergy Connect history' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getSynergyConnectHistoryHandler],
  },
];
