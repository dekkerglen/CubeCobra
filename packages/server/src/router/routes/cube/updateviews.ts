import { validateViewDefinitions } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../types/express';

export const updateViewsHandler = async (req: Request, res: Response) => {
  try {
    const { views } = req.body;

    // Validate views
    const validationResult = validateViewDefinitions(views);
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, message: validationResult.error });
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found.' });
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Update the cube's views
    cube.views = views;

    await cubeDao.update(cube);
    return res.status(200).json({ success: true, message: 'Views updated successfully.', views: cube.views });
  } catch (err) {
    req.logger.error('Error updating views:', err);
    return res.status(500).json({ success: false, message: 'Error updating views: ' + (err as Error).message });
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateViewsHandler],
  },
];
