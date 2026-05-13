import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

export const getApiDocsHandler = async (req: Request, res: Response) => {
  return render(req, res, 'ApiDocsPage', {}, { title: 'API Documentation' });
};

export const routes = [
  {
    method: 'get',
    path: '',
    handler: [getApiDocsHandler],
  },
];
