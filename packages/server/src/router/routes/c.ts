import { redirect } from '../../serverutils/render';
import { Request, Response } from '../../types/express';

// Cube shortcut redirect - /c/:id redirects to /cube/list/:id
const cubeRedirectHandler = (req: Request, res: Response) => {
  redirect(req, res, `/cube/list/${req.params.id}`);
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [cubeRedirectHandler],
  },
];
