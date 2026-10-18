import { redirect } from 'serverutils/render';
import { ISO_DATE, matchParam } from 'router/middleware';

import { Request, Response } from '../../types/express';

// Vanity URLs (used in share text/images): cubecobra.com/manamatrix
export const manaMatrixRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, '/tool/manamatrix');
};

export const manaMatrixArchiveRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, '/tool/manamatrix/archive');
};

export const manaMatrixDateRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/tool/manamatrix/${req.params.date}`);
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [manaMatrixRedirectHandler],
  },
  {
    method: 'get',
    path: '/archive',
    handler: [manaMatrixArchiveRedirectHandler],
  },
  {
    method: 'get',
    path: '/:date',
    handler: [matchParam('date', ISO_DATE), manaMatrixDateRedirectHandler],
  },
];
