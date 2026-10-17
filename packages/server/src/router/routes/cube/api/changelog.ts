import { changelogDao, cubeDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import { isCubeViewable } from 'serverutils/cubefn';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { NextFunction, Request, Response } from '../../../../types/express';

const publicCORS = (_req: Request, res: Response, next: NextFunction) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

export const changelogHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    const changelog = await changelogDao.getById(req.params.changelogId!);
    if (!changelog || changelog.cube !== cube.id) {
      return res.status(404).send('Changelog not found.');
    }

    const changes = await changelogDao.getChangelog(cube.id, changelog.id);

    return res.status(200).send({
      id: changelog.id,
      cubeId: cube.id,
      date: changelog.date,
      cubeVersion: changelog.cubeVersion,
      changes,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send('Error retrieving changelog.');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id/:changelogId',
    handler: [publicCORS, apiLimiter, changelogHandler],
  },
];
