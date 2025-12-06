import Cube from 'dynamo/models/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

export const savesortsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await Cube.getById(req.params.id);
    const { sorts, showUnsorted, collapseDuplicateCards } = req.body;

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!req.user || cube.owner.id !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    cube.defaultSorts = sorts || [];
    cube.showUnsorted = showUnsorted || false;
    if (collapseDuplicateCards !== undefined) {
      cube.collapseDuplicateCards = collapseDuplicateCards;
    }
    await Cube.update(cube);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error saving sorts',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, savesortsHandler],
  },
];
