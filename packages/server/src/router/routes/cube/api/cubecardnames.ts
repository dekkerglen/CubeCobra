import Cube from 'dynamo/models/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { binaryInsert, turnToTree } from 'serverutils/util';
import { cardFromId } from '../../../../serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const cubecardnamesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.board) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID and board are required',
      });
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not found',
      });
    }

    const cubeCards = await Cube.getCards(cube.id);

    const cardnames: string[] = [];

    for (const card of cubeCards[req.params.board]) {
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
