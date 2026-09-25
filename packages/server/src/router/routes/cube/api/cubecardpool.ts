import { boardNameToKey } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { cardFromId } from 'serverutils/carddb';
import { getBasicsFromCube } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

// Returns the full list of card names on a cube board (default: mainboard), plus
// the cube's basic lands. Used by the client-side photo scanner to fuzzy-match OCR
// output against the bounded set of cards actually in the cube. This is the cube's
// own card list (the requester can already view every card), and the much larger
// global card-name catalog still never ships to the browser.
//
// Basics live on their own board (or the legacy cube.basics), so they are folded
// into `names` — otherwise a photographed "Forest" could never match in-cube — and
// returned separately as `basics` (card id + name) so the deck editor can offer them
// as lands to add.
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

    // Dedupe — a name only needs to appear once for fuzzy matching.
    const seen = new Set<string>();
    const names: string[] = [];
    const addName = (cardID: string): string | undefined => {
      const { name } = cardFromId(cardID);
      if (!name) {
        return undefined;
      }
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
      return name;
    };

    for (const card of board ?? []) {
      addName(card.cardID);
    }

    // The cube's basics, in board order, deduped independently of `names` so a
    // basic that also sits on the requested board is still offered once here.
    const basicsSeen = new Set<string>();
    const basics: { cardID: string; name: string }[] = [];
    // `|| 'Basics'` matches every other basics reader (simulatesetup, draftmancer
    // publish, the draft simulator): a cube that never set basicsBoard explicitly still
    // keeps its basics on the conventional "Basics" board. Passing the raw field instead
    // falls through to the legacy cube.basics array, which modern cubes leave empty.
    for (const cardID of getBasicsFromCube(cubeCards, cube.basicsBoard || 'Basics', cube.basics)) {
      const name = addName(cardID);
      if (name && !basicsSeen.has(name)) {
        basicsSeen.add(name);
        basics.push({ cardID, name });
      }
    }

    return res.status(200).send({ success: 'true', names, basics });
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
