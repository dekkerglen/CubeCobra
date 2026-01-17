import { cardUpdateTaskDao } from 'dynamo/daos';
import { handleRouteError, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const getCardUpdatesHandler = async (req: Request, res: Response) => {
  try {
    // Get the last 10 card updates (all statuses)
    const { items } = await cardUpdateTaskDao.listAll(10);

    return render(
      req,
      res,
      'CardUpdatesPage',
      {
        updates: items,
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
