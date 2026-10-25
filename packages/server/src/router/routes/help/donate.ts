import { render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

const donateHandler = (req: Request, res: Response) => {
  return render(req, res, 'DonatePage', {}, { title: 'Donate' });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [donateHandler],
  },
];
