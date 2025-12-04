import { redirect } from 'serverutils/render';
import { csrfProtection } from 'src/router/middleware';

import { Request, Response } from '../../../types/express';

// Redirect old P1P1 URLs to new cube-based URLs
export const redirectP1P1Handler = (req: Request, res: Response) => {
  return redirect(req, res, `/cube/p1p1/${req.params.packId}`);
};

export const routes = [
  {
    method: 'get',
    path: '/:packId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
    handler: [csrfProtection, redirectP1P1Handler],
  },
];
