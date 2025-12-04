import { makeFilter } from '@utils/filtering/FilterCards';
import { OrderedSortsType } from '@utils/sorting/Sort';
import { SortDirectionsType } from '@utils/sorting/sortContext';
import { searchCards } from 'serverutils/tools';

import { Request, Response } from '../../../../types/express';

type Distinct = 'names' | 'printing';

export const searchCardsHandler = async (req: Request, res: Response) => {
  try {
    const { err, filter } = makeFilter(req.query.f as string);
    if (err) {
      res.status(400).send({
        success: 'false',
        numResults: 0,
        data: [],
      });
      return;
    }
    const page = typeof req.query.p === 'string' ? parseInt(req.query.p, 10) : 0;
    const { data, numResults } = searchCards(
      filter!,
      req.query.s as OrderedSortsType,
      page,
      req.query.d as SortDirectionsType,
      req.query.di as Distinct | undefined,
      req?.user?.defaultPrinting,
    );
    res.status(200).send({
      success: 'true',
      data,
      numResults,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    res.status(500).send({
      success: 'false',
      numResults: 0,
      data: [],
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: searchCardsHandler,
  },
];
