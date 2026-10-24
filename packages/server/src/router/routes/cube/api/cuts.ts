import { makeFilter, MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import { cubeDao } from 'dynamo/daos';
import { getAllMostReasonable, getReasonableCardByOracleWithPrintingPreference } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';
import { jsonLimiter } from 'serverutils/rateLimiters';
import { recommend } from 'serverutils/ml';

import { Request, Response } from '../../../../types/express';

export const cutsHandler = async (req: Request, res: Response) => {
  try {
    const { cubeID, filterText, printingPreference } = req.body;

    if (!cubeID || typeof cubeID !== 'string') {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
        cuts: [],
      });
    }

    const cube = await cubeDao.getById(cubeID);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
        cuts: [],
      });
    }

    const cards = await cubeDao.getCards(cube.id, cube);

    const oracles = cards.mainboard.map((card: any) => card.details?.oracle_id).filter(Boolean);

    const { cuts } = await recommend(oracles);

    let slice = cuts || [];

    if (filterText && filterText.length > 0) {
      const { err, filter } =
        `${filterText}`.length > MAX_SEARCH_FILTER_LENGTH
          ? { err: 'Filter is too long', filter: null }
          : makeFilter(`${filterText}`);

      if (err || !filter) {
        return res.status(400).send({
          success: 'false',
          cuts: [],
        });
      }

      const eligible = getAllMostReasonable(filter, printingPreference);

      const oracleToEligible = Object.fromEntries(eligible.map((card) => [card.oracle_id, true]));

      slice = cuts?.filter((item: any) => oracleToEligible[item.oracle]) || [];
    }

    return res.status(200).send({
      cuts: slice.map((item: any) => {
        const card = getReasonableCardByOracleWithPrintingPreference(item.oracle, printingPreference);
        return {
          details: card,
          cardID: card.scryfall_id,
        };
      }),
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving cut recommendations',
      cuts: [],
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    // Each call runs a recommender query plus a filter parse, so keep anonymous callers in check.
    handler: [jsonLimiter(60_000, 60), cutsHandler],
  },
];
