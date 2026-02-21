import { boardNameToKey, getBoardDefinitions } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { cardFromId } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';
import { binaryInsert, turnToTree } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

export const cubecardnamesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.board) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID and board are required',
      });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not found',
      });
    }

    const cubeCards = await cubeDao.getCards(cube.id);

    const boardParam = req.params.board;
    // Convert board name to storage key (handles both display names and keys)
    const boardKey = boardNameToKey(boardParam);

    // Validate board exists in cube's cards
    if (!cubeCards[boardKey]) {
      // Check if it's a valid board name from cube's boards
      const boardDefs = getBoardDefinitions(cube, cubeCards);
      const validBoardNames = boardDefs.map((b) => b.name);
      const validBoardKeys = boardDefs.map((b) => boardNameToKey(b.name));

      if (!validBoardKeys.includes(boardKey)) {
        return res.status(400).send({
          success: 'false',
          message: `Invalid board. Valid boards: ${validBoardNames.join(', ')}`,
        });
      }

      // Board is valid but empty
      return res.status(200).send({
        success: 'true',
        cardnames: {},
      });
    }

    const cardnames: string[] = [];

    for (const card of cubeCards[boardKey]) {
      binaryInsert(cardFromId(card.cardID).name, cardnames);
    }

    const result = turnToTree(cardnames);
    return res.status(200).send({
      success: 'true',
      cardnames: result,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving cube card names',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id/:board',
    handler: [cubecardnamesHandler],
  },
];
