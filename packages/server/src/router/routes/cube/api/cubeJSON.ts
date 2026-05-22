import Card from '@utils/datatypes/Card';
import { sortForDownload } from '@utils/sorting/Sort';
import { cubeDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import { parseDateParam, resolveCubeCards } from 'serverutils/cubeCards';
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

    const dateMs = parseDateParam(req.query.date as string | undefined);
    if (dateMs !== undefined && isNaN(dateMs)) {
      return res.status(400).send('Invalid date parameter. Must be a unix timestamp in milliseconds.');
    }

    const { cards: cubeCards, changelog: changelogMeta } = await resolveCubeCards(cube.id, dateMs);

    // Sort every board using the default ordered sort
    for (const boardName of Object.keys(cubeCards)) {
      const board = cubeCards[boardName];
      if (Array.isArray(board)) {
        cubeCards[boardName] = sortForDownload(board as Card[]);
      }
    }

    const response: Record<string, any> = { ...cube, cards: cubeCards };
    if (changelogMeta) {
      response.changelog = changelogMeta;
    }

    res.contentType('application/json');
    return res.status(200).send(JSON.stringify(response));
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
