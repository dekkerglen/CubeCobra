import { makeFilter } from '@utils/filtering/FilterCards';
import { getAllMostReasonable, getReasonableCardByOracleWithPrintingPreference } from '../../../../serverutils/carddb';
import Cube from 'dynamo/models/cube';
import { recommend } from '../../../../serverutils/ml';
import { Request, Response } from '../../../../types/express';

export const cutsHandler = async (req: Request, res: Response) => {
  try {
    const { cubeID, filterText, printingPreference } = req.body;

    if (!cubeID) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
        cuts: [],
      });
    }

    const cards = await Cube.getCards(cubeID);

    const { cuts } = recommend(cards.mainboard.map((card: any) => card.details.oracle_id));

    let slice = cuts || [];

    if (filterText && filterText.length > 0) {
      const { err, filter } = makeFilter(`${filterText}`);

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
    handler: [cutsHandler],
  },
];
