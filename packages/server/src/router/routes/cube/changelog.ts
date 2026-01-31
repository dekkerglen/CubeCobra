import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const changelogHandler = async (req: Request, res: Response) => {
  // Redirect to the new consolidated about page with changelog view
  return redirect(req, res, `/cube/about/${req.params.id}?view=changelog`);
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [changelogHandler],
  },
];
