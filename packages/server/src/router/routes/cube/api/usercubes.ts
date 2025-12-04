import Cube from 'dynamo/models/cube';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const usercubesHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    return res.status(400).send({
      success: 'false',
      message: 'User ID is required',
    });
  }

  const cubes = await Cube.getByOwner(req.params.id);

  return res.status(200).send({
    success: 'true',
    cubes: cubes.items.filter((cube) => isCubeViewable(cube, req.user)),
  });
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [usercubesHandler],
  },
];
