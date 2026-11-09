import { render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const mlPlaygroundHandler = async (req: Request, res: Response) =>
  render(req, res, 'MlPlaygroundPage', {}, { title: 'ML Playground' });

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [mlPlaygroundHandler],
  },
];
