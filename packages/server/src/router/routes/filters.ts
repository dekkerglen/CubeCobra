import { render } from 'serverutils/render';
import { Request, Response } from '../../types/express';

const filtersHandler = (req: Request, res: Response) => {
  return render(req, res, 'FiltersPage');
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [filtersHandler],
  },
];
