import { cubeDao, dailyP1P1Dao } from 'dynamo/daos';
import p1p1PackModel from 'dynamo/models/p1p1Pack';
import { render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const getArchiveHandler = async (req: Request, res: Response) => {
  try {
    const limit = 10;

    // Get daily P1P1 archive
    const result = await dailyP1P1Dao.getDailyP1P1History(undefined, limit);

    let history = [];
    let hasMore = false;
    let lastKey = null;

    if (result.items && result.items.length > 0) {
      // Get pack and cube data for each history item
      const historyWithData = await Promise.all(
        result.items.map(async (item: any) => {
          const [pack, cube] = await Promise.all([p1p1PackModel.getById(item.packId), cubeDao.getById(item.cubeId)]);

          return {
            ...item,
            pack,
            cube,
          };
        }),
      );

      // Filter out items where pack or cube couldn't be loaded
      history = historyWithData.filter((item: any) => item.pack && item.cube);
      hasMore = !!result.lastKey;
      lastKey = result.lastKey ? JSON.stringify(result.lastKey) : null;
    }

    return render(req, res, 'DailyP1P1HistoryPage', {
      history,
      hasMore,
      lastKey,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error loading daily P1P1 archive page:', error);
    req.flash('danger', 'Error loading daily P1P1 archive');
    return render(req, res, 'ExplorePage', {}, { title: 'Explore' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getArchiveHandler],
  },
];
