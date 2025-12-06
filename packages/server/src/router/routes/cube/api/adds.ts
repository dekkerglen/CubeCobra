import { makeFilter } from '@utils/filtering/FilterCards';
import Cube from 'dynamo/models/cube';

import { getAllMostReasonable, getReasonableCardByOracleWithPrintingPreference } from 'serverutils/carddb';
import { recommend } from 'serverutils/ml';
import { Request, Response } from '../../../../types/express';

export const addsHandler = async (req: Request, res: Response) => {
  try {
    let { skip, limit } = req.body;
    const { cubeID, filterText, printingPreference } = req.body;

    if (!cubeID) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
        adds: [],
        hasMoreAdds: false,
      });
    }

    limit = parseInt(limit, 10);
    skip = parseInt(skip, 10);

    const cards = await Cube.getCards(cubeID);

    const { adds } = recommend(cards.mainboard.map((card: any) => card.details.oracle_id));

    let slice;
    let { length } = adds;

    if (filterText && filterText.length > 0) {
      const { err, filter } = makeFilter(`${filterText}`);

      if (err || !filter) {
        return res.status(400).send({
          success: 'false',
          adds: [],
          hasMoreAdds: false,
        });
      }

      const eligible = getAllMostReasonable(filter, printingPreference);
      length = eligible.length;

      const oracleToEligible = Object.fromEntries(eligible.map((card) => [card.oracle_id, true]));

      slice = adds.filter((item: any) => oracleToEligible[item.oracle]).slice(skip, skip + limit);
    } else {
      slice = adds.slice(skip, skip + limit);
    }

    return res.status(200).send({
      adds: slice.map((item: any) => {
        const card = getReasonableCardByOracleWithPrintingPreference(item.oracle, printingPreference);
        return {
          details: card,
          cardID: card.scryfall_id,
        };
      }),
      hasMoreAdds: length > skip + limit,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving recommendations',
      adds: [],
      hasMoreAdds: false,
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [addsHandler],
  },
];
