import { getCubeSorts, sortForDownload } from '@utils/sorting/Sort';
import { cubeDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import { isCubeViewable } from 'serverutils/cubefn';

import { NextFunction, Request, Response } from '../../../../types/express';

// CORS middleware for public API
const publicCORS = (_req: Request, res: Response, next: NextFunction) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
};

// Rate limiter for public API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: '429: Too Many Requests',
});

export const cubeJSONHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send('Cube ID is required.');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    if (!cube) {
      return res.status(404).send('Cube not found.');
    }

    const cubeCards = await cubeDao.getCards(cube.id);

    const sorts = getCubeSorts(cube);
    const sortedMainboard = sortForDownload(
      cubeCards.mainboard,
      sorts[0],
      sorts[1],
      sorts[2],
      sorts[3],
      cube.showUnsorted || false,
    );
    cubeCards.mainboard = sortedMainboard;

    const sortedMaybeboard = sortForDownload(
      cubeCards.maybeboard,
      sorts[0],
      sorts[1],
      sorts[2],
      sorts[3],
      cube.showUnsorted || false,
    );
    cubeCards.maybeboard = sortedMaybeboard;

    res.contentType('application/json');
    return res.status(200).send(JSON.stringify({ ...cube, cards: cubeCards }));
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send('Error retrieving cube JSON.');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [publicCORS, apiLimiter, cubeJSONHandler],
  },
];
