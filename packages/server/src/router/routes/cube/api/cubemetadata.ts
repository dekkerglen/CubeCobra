import { cubeDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const cubemetadataHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send('Cube ID is required.');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    return res.status(200).send({
      success: 'true',
      cube,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send('Error retrieving cube metadata.');
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [cubemetadataHandler],
  },
];
