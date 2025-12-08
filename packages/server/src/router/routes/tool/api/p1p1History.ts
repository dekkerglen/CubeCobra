import { cubeDao } from 'dynamo/daos';
import dailyP1P1Model from 'dynamo/models/dailyP1P1';
import p1p1PackModel from 'dynamo/models/p1p1Pack';

import { Request, Response } from '../../../../types/express';

export const getDailyP1P1HistoryHandler = async (req: Request, res: Response) => {
  try {
    const { lastKey } = req.query;
    const limit = 10;

    // Get daily P1P1 history
    const result = await dailyP1P1Model.getDailyP1P1History(lastKey ? JSON.parse(lastKey as string) : undefined, limit);

    if (!result.items || result.items.length === 0) {
      return res.status(200).json({
        success: true,
        history: [],
        hasMore: false,
        lastKey: null,
      });
    }

    // Get pack and cube data for each history item
    const historyWithData = await Promise.all(
      result.items.map(async (item) => {
        const [pack, cube] = await Promise.all([p1p1PackModel.getById(item.packId), cubeDao.getById(item.cubeId)]);

        return {
          ...item,
          pack,
          cube,
        };
      }),
    );

    // Filter out items where pack or cube couldn't be loaded
    const validHistory = historyWithData.filter((item) => item.pack && item.cube);

    return res.status(200).json({
      success: true,
      history: validHistory,
      hasMore: !!result.lastKey,
      lastKey: result.lastKey ? JSON.stringify(result.lastKey) : null,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching daily P1P1 history' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/history',
    handler: getDailyP1P1HistoryHandler,
  },
];
