import Cube from 'dynamo/models/cube';
import { cubeCardTags, isCubeViewable } from 'serverutils/cubefn';
import { turnToTree } from 'serverutils/util';
import { Request, Response } from '../../../../types/express';

export const cubecardtagsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    const cubeCards = await Cube.getCards(cube.id);
    const tags = cubeCardTags([...cubeCards.mainboard, ...cubeCards.maybeboard]);

    return res.status(200).send({
      success: 'true',
      tags: turnToTree(tags),
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving cube card tags',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [cubecardtagsHandler],
  },
];
