import { render } from 'serverutils/render';
import { Request, Response } from '../../../types/express';

export const getSearchCardsHandler = async (req: Request, res: Response) =>
  render(
    req,
    res,
    'CardSearchPage',
    {},
    {
      title: 'Search cards',
    },
  );

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getSearchCardsHandler],
  },
];
