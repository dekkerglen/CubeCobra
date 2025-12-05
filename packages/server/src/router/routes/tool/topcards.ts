import { makeFilter } from '@utils/filtering/FilterCards';
import { OrderedSortsType } from '@utils/sorting/Sort';
import { SortDirectionsType } from '@utils/sorting/sortContext';
import { handleRouteError, render } from 'serverutils/render';
import { searchCards } from 'serverutils/tools';

import { Request, Response } from '../../../types/express';

/* Minimum number of picks for data to show up in Top cards list. */
const MIN_PICKS = 100;

export const getTopCardsHandler = async (req: Request, res: Response) => {
  try {
    const { filter } = makeFilter(`pickcount>=${MIN_PICKS} ${req.query.f}`);
    const { data, numResults } = await searchCards(
      filter!,
      req.query.s as OrderedSortsType,
      parseInt(req.query.p as string, 10),
      req.query.d as SortDirectionsType,
      'names',
      req?.user?.defaultPrinting,
    );

    return render(
      req,
      res,
      'TopCardsPage',
      {
        data,
        numResults,
      },
      {
        title: 'Top cards',
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getTopCardsHandler],
  },
];
