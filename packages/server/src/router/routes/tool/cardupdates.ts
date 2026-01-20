import { cardUpdateTaskDao, exportTaskDao, migrationTaskDao } from 'dynamo/daos';
import { handleRouteError, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const getCardUpdatesHandler = async (req: Request, res: Response) => {
  try {
    // Get the last 10 card updates (all statuses)
    const { items: cardUpdates } = await cardUpdateTaskDao.listAll(10);

    // Get the last 10 export tasks (all statuses)
    const { items: exportTasks } = await exportTaskDao.listAll(10);

    // Get the last 10 migration tasks (all statuses)
    const { items: migrationTasks } = await migrationTaskDao.listAll(10);

    return render(
      req,
      res,
      'CardUpdatesPage',
      {
        cardUpdates,
        exportTasks,
        migrationTasks,
      },
      {
        title: 'Card Updates',
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getCardUpdatesHandler],
  },
];
