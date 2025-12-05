import { redirect } from '../../serverutils/render';
import { Request, Response } from '../../types/express';

// Draft shortcut redirect - /d/:id redirects to /draft/:id
const draftRedirectHandler = (req: Request, res: Response) => {
  redirect(req, res, `/draft/${req.params.id}`);
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [draftRedirectHandler],
  },
];
