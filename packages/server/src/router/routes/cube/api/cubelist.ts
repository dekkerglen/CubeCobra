import { cubeDao } from 'dynamo/daos';
import { cardFromId } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const cubelistHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send('Cube ID is required.');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    const cubeCards = await cubeDao.getCards(cube.id);

    const names = cubeCards.mainboard.map((card: any) => cardFromId(card.cardID).name);
    res.contentType('text/plain');
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(200).send(names.join('\n'));
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send('Error retrieving cube list.');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [cubelistHandler],
  },
];
