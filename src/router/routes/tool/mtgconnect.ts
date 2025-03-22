import { PrintingPreference } from 'datatypes/Card';

import { Request, Response } from '../../../types/express';
import { getReasonableCardByOracle, getRelatedCards } from '../../../util/carddb';

export const handler = async (req: Request, res: Response) => {
  const { oracles } = req.body;

  const cards = oracles.map((oracle: string) => getReasonableCardByOracle(oracle));

  const result = [];

  for (const card of cards) {
    const related = getRelatedCards(card.oracle_id, PrintingPreference.FIRST);
    const synergistic = related.synergistic.top.map((oracle) => getReasonableCardByOracle(oracle.oracle_id));

    result.push({
      name: card.name,
      image_normal: card.image_normal,
      oracle: card.oracle_id,
      popularity: card.cubeCount,
      synergistic: synergistic.slice(0, 5).map((c) => ({
        name: c.name,
        image_normal: c.image_normal,
        oracle: c.oracle_id,
      })),
    });
  }

  return res.status(200).send({
    success: 'true',
    cards: result,
  });
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [handler],
  },
];
