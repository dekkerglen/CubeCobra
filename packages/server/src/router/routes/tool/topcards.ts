import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

// Top Cards is card search's rows view limited to well-drafted cards.
const TOP_CARDS_FILTER = 'picks>=100';

export const getTopCardsHandler = async (req: Request, res: Response) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  const filter = params.get('f')?.trim();
  params.set('f', filter ? `${TOP_CARDS_FILTER} ${filter}` : TOP_CARDS_FILTER);
  params.set('v', 'rows');
  return redirect(req, res, `/tool/searchcards?${params.toString()}`);
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getTopCardsHandler],
  },
];
