import { redirect } from 'serverutils/render';
import { ISO_DATE, matchParam } from 'router/middleware';

import { Request, Response } from '../../types/express';

// Vanity URLs (used in share text): cubecobra.com/synergyconnect
export const synergyConnectRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, '/tool/synergyconnect');
};

export const synergyConnectArchiveRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, '/tool/synergyconnect/archive');
};

export const synergyConnectDateRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/tool/synergyconnect/${req.params.date}`);
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [synergyConnectRedirectHandler],
  },
  {
    method: 'get',
    path: '/archive',
    handler: [synergyConnectArchiveRedirectHandler],
  },
  {
    method: 'get',
    path: '/:date',
    handler: [matchParam('date', ISO_DATE), synergyConnectDateRedirectHandler],
  },
];
