import CubeType, { CUBE_CATEGORIES } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { getCubeId, isCubeViewable } from 'serverutils/cubefn';
import { hasProfanity } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

export const editOverviewHandler = async (req: Request, res: Response) => {
  try {
    const updatedCube: CubeType = req.body.cube;

    const cube = await cubeDao.getById(updatedCube.id);
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
        .json({ error: 'Cannot update the cube overview for an empty cube. Please add cards to the cube first.' });
      return;
    }

    if (hasProfanity(updatedCube.name)) {
      res.status(400).json({
        error:
          'Could not update cube, the name contains a banned word. If you feel this was a mistake, please contact us.',
      });
      return;
    }

    if (updatedCube.shortId !== cube.shortId) {
      if (hasProfanity(updatedCube.shortId)) {
        res.status(400).json({
          error:
            'Could not update cube, the short id contains a banned word. If you feel this was a mistake, please contact us.',
        });
        return;
      }

      // Check if shortId is already taken by another cube
      const existingCube = await cubeDao.getById(updatedCube.shortId);

      if (existingCube && existingCube.id !== cube.id) {
        res.status(400).json({ error: 'Could not update cube, the short id is already taken.' });
        return;
      }

      cube.shortId = updatedCube.shortId;
    }

    cube.name = updatedCube.name;
    cube.imageName = updatedCube.imageName;

    if (updatedCube.description !== null) {
      cube.description = updatedCube.description;
    }

    if (updatedCube.brief !== undefined) {
      cube.brief = updatedCube.brief;
    }

    cube.date = Date.now().valueOf();

    // cube category override
    if (updatedCube.categoryOverride !== null) {
      const categories = ['', ...CUBE_CATEGORIES];

      if (updatedCube.categoryOverride && !categories.includes(updatedCube.categoryOverride)) {
        res.status(400).json({ error: 'Not a valid category override.' });
        return;
      }

      cube.categoryOverride = updatedCube.categoryOverride;
    } else {
      cube.categoryOverride = undefined;
    }

    if (updatedCube.categoryPrefixes !== null) {
      const prefixes = [
        'Powered',
        'Unpowered',
        'Pauper',
        'Peasant',
        'Budget',
        'Silver-bordered',
        'Commander',
        'Battle Box',
        'Multiplayer',
        'Judge Tower',
        'Desert',
      ];
      for (let i = 0; i < (updatedCube.categoryPrefixes || []).length; i += 1) {
        if (!prefixes.includes(updatedCube.categoryPrefixes[i])) {
          res.status(400).json({ error: 'Not a valid category prefix.' });
          return;
        }
      }
      cube.categoryPrefixes = updatedCube.categoryPrefixes;
    } else {
      cube.categoryPrefixes = [];
    }

    // cube tags
    cube.tags = updatedCube.tags.filter((tag) => tag && tag.length > 0).map((tag) => tag.toLowerCase());

    await cubeDao.update(cube);

    const redirect = `/cube/primer/${getCubeId(cube)}`;

    res.status(200).json({ success: 'Cube updated successfully', redirect });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    res.status(500).json({ error: 'Error updating cube' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [ensureAuth, csrfProtection, editOverviewHandler],
  },
];
