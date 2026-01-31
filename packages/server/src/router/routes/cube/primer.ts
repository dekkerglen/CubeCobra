import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const primerHandler = async (req: Request, res: Response) => {
  // Redirect to the new consolidated about page with primer view
  return redirect(req, res, `/cube/about/${req.params.id}?view=primer`);
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [primerHandler],
  },
];
