import { redirect } from 'serverutils/render';

import { Request, Response } from '../../types/express';

// Vanity URLs (used in share text): cubecobra.com/crossword
export const crosswordRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, '/tool/crossword');
};

export const crosswordArchiveRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, '/tool/crossword/archive');
};

export const crosswordDateRedirectHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/tool/crossword/${req.params.date}`);
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [crosswordRedirectHandler],
  },
  {
    method: 'get',
    path: '/archive',
    handler: [crosswordArchiveRedirectHandler],
  },
  {
    method: 'get',
    path: '/:date([0-9]{4}-[0-9]{2}-[0-9]{2})',
    handler: [crosswordDateRedirectHandler],
  },
];
