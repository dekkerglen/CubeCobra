import { cardFromId } from 'serverutils/carddb';

import { Request, Response } from '../../../../types/express';

export const getdetailsforcardsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.body.cards || !Array.isArray(req.body.cards)) {
      return res.status(400).send({
        success: 'false',
        message: 'cards array is required',
      });
    }

    // Pre-size array to avoid reallocation during map
    const cards = req.body.cards;
    const details = new Array(cards.length);
    for (let i = 0; i < cards.length; i++) {
      details[i] = cardFromId(cards[i]);
    }

    return res.status(200).send({
      success: 'true',
      details,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving card details',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [getdetailsforcardsHandler],
  },
];
