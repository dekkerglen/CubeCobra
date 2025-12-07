import { render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const contactHandler = (req: Request, res: Response) => {
  return render(req, res, 'ContactPage');
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [contactHandler],
  },
];
