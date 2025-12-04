import Cube from 'dynamo/models/cube';
import { cardFromId } from 'serverutils/carddb';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const getCardImageForCubeHandler = async (req: Request, res: Response) => {
  try {
    const { id, cubeid } = req.params;

    if (!cubeid) {
      req.flash('danger', 'Cube ID is required.');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cubeid);
    const main = cards.mainboard;

    const found = main
      .map((card: any) => ({ details: cardFromId(card.cardID), ...card }))
      .find(
        (card: any) =>
          id && (id === card.cardID || id.toLowerCase() === card.details.name_lower || id === card.details.oracleId),
      );

    // if id is not a scryfall ID, error
    const card = cardFromId(found ? found.cardID : '');
    if (card.error || !card.image_normal) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    return redirect(req, res, card.image_normal);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id/:cubeid',
    handler: [getCardImageForCubeHandler],
  },
];
