import { boardNameToKey } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { cardFromId } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

// Returns the full list of card names on a cube board (default: mainboard).
// Used by the client-side photo scanner to fuzzy-match OCR output against the
// bounded set of cards actually in the cube. This is the cube's own card list
// (the requester can already view every card), and the much larger global
// card-name catalog still never ships to the browser.
export const cubeCardPoolHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ success: 'false', message: 'Cube ID is required' });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', message: 'Not found' });
    }

    const cubeCards = await cubeDao.getCards(cube.id);
    const boardKey = boardNameToKey(typeof req.query.board === 'string' ? req.query.board : 'mainboard');
    const board = cubeCards[boardKey];

    if (!board) {
      return res.status(200).send({ success: 'true', names: [] });
    }

    // Dedupe — a name only needs to appear once for fuzzy matching.
    const seen = new Set<string>();
    const names: string[] = [];
    for (const card of board) {
      const { name } = cardFromId(card.cardID);
      if (name && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }

    return res.status(200).send({ success: 'true', names });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', message: 'Error retrieving cube card pool' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [cubeCardPoolHandler],
  },
];
