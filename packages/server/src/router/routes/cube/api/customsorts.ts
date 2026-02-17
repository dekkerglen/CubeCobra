import { cubeDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const customsortsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await cubeDao.getById(req.params.id);
    const { customSorts } = req.body;

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

    // Validate custom sorts structure
    if (customSorts && !Array.isArray(customSorts)) {
      return res.status(400).send({
        success: 'false',
        message: 'customSorts must be an array',
      });
    }

    // Validate each custom sort
    if (customSorts) {
      for (const sort of customSorts) {
        if (!sort.name || typeof sort.name !== 'string') {
          return res.status(400).send({
            success: 'false',
            message: 'Each sort must have a name',
          });
        }
        if (!Array.isArray(sort.categories)) {
          return res.status(400).send({
            success: 'false',
            message: 'Each sort must have a categories array',
          });
        }
        if (typeof sort.matchFirstOnly !== 'boolean') {
          return res.status(400).send({
            success: 'false',
            message: 'Each sort must have a matchFirstOnly boolean',
          });
        }
        for (const category of sort.categories) {
          if (!category.label || typeof category.label !== 'string') {
            return res.status(400).send({
              success: 'false',
              message: 'Each category must have a label',
            });
          }
          if (typeof category.filter !== 'string') {
            return res.status(400).send({
              success: 'false',
              message: 'Each category must have a filter string',
            });
          }
        }
      }
    }

    cube.customSorts = customSorts || [];
    console.log('[customsorts] Before update, cube.customSorts:', cube.customSorts);
    await cubeDao.update(cube);
    console.log('[customsorts] After update, saved successfully');

    return res.status(200).send({
      success: 'true',
      cube: {
        id: cube.id,
        customSorts: cube.customSorts,
      },
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error saving custom sorts',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, customsortsHandler],
  },
];
