import { redirect } from 'serverutils/render';
import { Request, Response } from '../../../types/express';

export const handler = (req: Request, res: Response) => {
  req.session.destroy(() => {
    return redirect(req, res, '/');
  });
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [handler],
  },
];
