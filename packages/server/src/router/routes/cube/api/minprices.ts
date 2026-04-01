import { PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { cardFromId, getIdsFromName } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const minPricesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ success: 'false', error: 'Cube ID is required.' });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', error: 'Cube not found.' });
    }

    if (cube.priceVisibility !== PRICE_VISIBILITY.PUBLIC) {
      return res.status(403).send({ success: 'false', error: 'Prices are private for this cube.' });
    }

    const cards = await cubeDao.getCards(cube.id);
    const { mainboard } = cards;

    // Build a map of card name → all version details (one lookup per unique name)
    const nameToCards: Record<string, any[]> = {};
    for (const card of mainboard) {
      if (card.details && !nameToCards[card.details.name]) {
        const allVersionIds = getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionIds.map((id: string) => cardFromId(id));
      }
    }

    // Find the cheapest printing for each card name
    const cheapestDict: Record<string, number> = {};
    for (const name of Object.keys(nameToCards)) {
      const versions = nameToCards[name] || [];
      let cheapest = Infinity;
      for (const version of versions) {
        if (version.prices?.usd && version.prices.usd < cheapest) {
          cheapest = version.prices.usd;
        }
        if (version.prices?.usd_foil && version.prices.usd_foil < cheapest) {
          cheapest = version.prices.usd_foil;
        }
      }
      if (cheapest < Infinity) {
        cheapestDict[name] = cheapest;
      }
    }

    // Sum up the cheapest price for each card in the mainboard
    let totalMinPrice = 0;
    for (const card of mainboard) {
      if (card.details) {
        totalMinPrice += cheapestDict[card.details.name] || 0;
      }
    }

    return res.status(200).send({
      success: 'true',
      totalMinPrice,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', error: 'Error computing min prices.' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [minPricesHandler],
  },
];
