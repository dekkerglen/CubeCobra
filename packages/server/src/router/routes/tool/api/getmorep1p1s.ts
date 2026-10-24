import { cubeDao, p1p1PackDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const getMoreP1P1sHandler = async (req: Request, res: Response) => {
  try {
    const { cubeId } = req.params;
    const { lastKey } = req.body;

    if (!cubeId) {
      return res.status(400).json({ error: 'Cube ID is required' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ error: 'Cube not found' });
    }

    const startKey = typeof lastKey === 'object' && lastKey !== null && !Array.isArray(lastKey) ? lastKey : undefined;
    const result = await p1p1PackDao.queryByCube(cube.id, startKey, 10);

    return res.status(200).json({
      success: true,
      packs: result.items || [],
      lastKey: result.lastKey,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching P1P1 packs' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:cubeId',
    handler: [getMoreP1P1sHandler],
  },
];
