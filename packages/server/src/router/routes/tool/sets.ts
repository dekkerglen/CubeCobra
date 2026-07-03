import carddb from 'serverutils/carddb';
import { render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

// We ship every set and let the client assemble the parent/child tree: paper
// sets form the top level, and child sets (tokens, promos, art series, alchemy,
// commander, etc.) are nested under them regardless of type. Pruning of
// non-paper top-level sets happens client-side in SetsPage.
export const getSetsHandler = async (req: Request, res: Response) => {
  const sets = Object.values(carddb.setdict);

  return render(
    req,
    res,
    'SetsPage',
    { sets },
    {
      title: 'Sets',
    },
  );
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getSetsHandler],
  },
];
