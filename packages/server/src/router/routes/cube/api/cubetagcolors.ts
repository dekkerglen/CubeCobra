import { cubeDao } from 'dynamo/daos';
import { buildTagColors, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const cubetagcolorsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    const cubeCards = await cubeDao.getCards(cube.id);

    const tagColors = buildTagColors(cube, cubeCards);
    const tags = tagColors.map((item) => item.tag);

    if (req.query.b_id) {
      const cubeB = await cubeDao.getById(req.query.b_id as string);
      const cubeBCards = await cubeDao.getCards(req.query.b_id as string);

      if (!isCubeViewable(cubeB, req.user)) {
        return res.status(404).send({
          success: 'false',
          message: 'Not Found',
        });
      }

      const bTagColors = buildTagColors(cubeB, cubeBCards);
      for (const bTag of bTagColors) {
        if (!tags.includes(bTag.tag)) {
          tagColors.push(bTag);
        }
      }
    }

    const showTagColors = req.user ? !req.user.hideTagColors : true;

    return res.status(200).send({
      success: 'true',
      tagColors,
      showTagColors,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error retrieving tag colors',
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [cubetagcolorsHandler],
  },
];
