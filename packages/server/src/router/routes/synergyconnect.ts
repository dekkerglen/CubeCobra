import { redirect } from 'serverutils/render';

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
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [synergyConnectDateRedirectHandler],
  },
];
