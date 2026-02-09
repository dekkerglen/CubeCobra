import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { getCubeId, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const editPrimerHandler = async (req: Request, res: Response) => {
  try {
    const { cubeId, description, tags } = req.body;

    const cube = await cubeDao.getById(cubeId);
    const { user } = req;

    if (!cube || !isCubeViewable(cube, user)) {
      res.status(404).json({ error: 'Cube not found' });
      return;
    }

    if (cube.owner.id !== user?.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // if this cube has no cards, we deny them from making any changes
    // this is a spam prevention measure
    if (cube.cardCount === 0) {
      res
        .status(400)
        .json({ error: 'Cannot update the cube primer for an empty cube. Please add cards to the cube first.' });
      return;
    }

    // Update description
    if (description !== undefined && description !== null) {
      cube.description = description;
    }

    // Update tags
    if (tags !== undefined && tags !== null) {
      cube.tags = tags.filter((tag: string) => tag && tag.length > 0).map((tag: string) => tag.toLowerCase());
    }

    cube.date = Date.now().valueOf();

    await cubeDao.update(cube);

    const redirect = `/cube/about/${getCubeId(cube)}?view=primer`;

    res.status(200).json({ success: 'Primer updated successfully', redirect });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    res.status(500).json({ error: 'Error updating primer' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [ensureAuth, csrfProtection, editPrimerHandler],
  },
];
