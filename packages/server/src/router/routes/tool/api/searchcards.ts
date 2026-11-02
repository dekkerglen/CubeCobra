import { toDistinct } from '@utils/cardSearchOptions';
import { makeFilter, MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import { OrderedSortsType } from '@utils/sorting/Sort';
import { SortDirectionsType } from '@utils/sorting/sortContext';
import { expensiveGetLimiter } from 'serverutils/rateLimiters';
import { searchCards } from 'serverutils/tools';
import { applyUniversesBeyondSetting } from 'serverutils/universesBeyond';

import { Request, Response } from '../../../../types/express';

export const searchCardsHandler = async (req: Request, res: Response) => {
  try {
    const filterText = req.query.f;
    const tooLong = typeof filterText === 'string' && filterText.length > MAX_SEARCH_FILTER_LENGTH;
    if ((filterText !== undefined && typeof filterText !== 'string') || tooLong) {
      res.status(400).send({
        success: 'false',
        numResults: 0,
        data: [],
      });
      return;
    }

    const { err, filter } = makeFilter(filterText as string);
    if (err) {
      res.status(400).send({
        success: 'false',
        numResults: 0,
        data: [],
      });
      return;
    }
    const page = typeof req.query.p === 'string' ? parseInt(req.query.p, 10) : 0;
    const includeExtras = req.query.ie === '1' || req.query.ie === 'true';
    const { data, numResults } = searchCards(
      applyUniversesBeyondSetting(filter, req.user, filterText)!,
      req.query.s as OrderedSortsType,
      page,
      req.query.d as SortDirectionsType,
      toDistinct(req.query.di as string | undefined),
      req?.user?.defaultPrinting,
      includeExtras,
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
    handler: [expensiveGetLimiter(60_000, 120), searchCardsHandler],
  },
];
