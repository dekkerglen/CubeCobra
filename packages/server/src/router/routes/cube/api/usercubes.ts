import { cubeDao } from 'dynamo/daos';
import { isCubeListed } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const usercubesHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    return res.status(400).send({
      success: 'false',
      message: 'User ID is required',
    });
  }

  const cubes = await cubeDao.queryByOwner(req.params.id);

  return res.status(200).send({
    success: 'true',
    // Unlisted and private cubes are only enumerable by their owner (and admins).
    cubes: cubes.items.filter((cube) => isCubeListed(cube, req.user)),
  });
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [usercubesHandler],
  },
];
