import { dailyP1P1Dao } from 'dynamo/daos';
import { redirect } from 'serverutils/render';
import { matchParam, UUID } from 'router/middleware';

import { Request, Response } from '../../../types/express';

// Redirect old P1P1 URLs to new cube-based URLs
export const redirectP1P1Handler = (req: Request, res: Response) => {
  return redirect(req, res, `/cube/p1p1/${req.params.packId}`);
};

// Stable URL for the current daily P1P1 (the pack id changes every day), so
// navigation can link to "today's" pack. Falls back to the archive.
export const dailyP1P1RedirectHandler = async (req: Request, res: Response) => {
  try {
    const current = await dailyP1P1Dao.getCurrentDailyP1P1();
    if (current) {
      return redirect(req, res, `/cube/p1p1/${current.packId}`);
    }
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error resolving current daily P1P1:', error);
  }
  return redirect(req, res, '/tool/p1p1/archive');
};

export const routes = [
  {
    method: 'get',
    path: '/daily',
    handler: [dailyP1P1RedirectHandler],
  },
  {
    method: 'get',
    path: '/:packId',
    handler: [matchParam('packId', UUID), redirectP1P1Handler],
  },
];
