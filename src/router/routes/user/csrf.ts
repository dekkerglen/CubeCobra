import { csrfProtection } from '../../../routes/middleware';
import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  return res.status(200).send({
    success: 'true',
    token: req.csrfToken(),
  });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, handler],
  },
];
