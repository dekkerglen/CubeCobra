import { validateBoardDefinitions } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../types/express';

export const updateBoardsHandler = async (req: Request, res: Response) => {
  try {
    const { boards } = req.body;

    // Validate boards
    const validationError = validateBoardDefinitions(boards);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found.' });
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Update the cube's boards
    cube.boards = boards;

    await cubeDao.update(cube);
    return res.status(200).json({ success: true, message: 'Boards updated successfully.', boards: cube.boards });
  } catch (err) {
    req.logger.error('Error updating boards:', err);
    return res.status(500).json({ success: false, message: 'Error updating boards: ' + (err as Error).message });
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateBoardsHandler],
  },
];
