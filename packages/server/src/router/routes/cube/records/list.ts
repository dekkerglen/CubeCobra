import { cubeDao, recordDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const getRecordsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;
  const cubeId = req.params.id;

  if (!cubeId) {
    return res.status(400).json({
      error: 'Invalid cube ID',
    });
  }

  try {
    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({
        error: 'Cube not found',
      });
    }

    const results = await recordDao.getByCube(cube.id, 20, lastKey || undefined);
    return res.status(200).json({
      success: 'true',
      records: results.items,
      lastKey: results.lastKey,
    });
  } catch {
    return res.status(500).json({
      error: 'Failed to retrieve records',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, getRecordsHandler],
  },
];
