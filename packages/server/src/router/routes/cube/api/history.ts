import { sanitizeChangelog } from 'dynamo/dao/ChangelogDynamoDao';
import { changelogDao, cubeDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import { isCubeViewable } from 'serverutils/cubefn';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { NextFunction, Request, Response } from '../../../../types/express';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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

export const historyHandler = async (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit as string | undefined;
    const limit = limitParam === undefined ? DEFAULT_LIMIT : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).send('Invalid limit parameter. Must be a positive integer.');
    }
    const includeChanges = req.query.includeChanges === '1' || req.query.includeChanges === 'true';

    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    const page = await changelogDao.queryByCubePage(
      cube.id,
      req.query.cursor as string | undefined,
      Math.min(limit, MAX_LIMIT),
    );
    if (!page) {
      return res.status(400).send('Invalid cursor parameter.');
    }

    // Each entry's changes are a separate S3 read, so they're only loaded when asked for.
    const bodies = includeChanges
      ? await Promise.all(page.items.map((item) => changelogDao.loadChangelogData(item)))
      : [];

    return res.status(200).send({
      cubeId: cube.id,
      changelogs: page.items.map(({ id, date, cubeVersion }, i) => {
        if (!includeChanges) return { id, date, cubeVersion };
        // Cards ship as scryfall IDs only. An unreadable body comes back null, as in the history view.
        const body = bodies[i];
        return { id, date, cubeVersion, changes: body ? sanitizeChangelog(body) : null };
      }),
      nextCursor: page.cursor,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send('Error retrieving cube history.');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [publicCORS, apiLimiter, historyHandler],
  },
];
