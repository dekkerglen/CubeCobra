import { cubeDao } from 'dynamo/daos';
import { ensureAuthJson } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

/**
 * GET /cube/api/followedcubes
 *
 * Returns the list of cubes the current user follows (likes), filtered to those
 * the user can view.
 */
export const followedCubesHandler = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const likedIds = await cubeDao.queryCubesLikedBy(userId, undefined, 200);
  const cubes = (await cubeDao.batchGet(likedIds.cubeIds))
    .filter((cube) => isCubeViewable(cube, req.user))
    .map((cube) => ({
      id: cube.id,
      shortId: cube.shortId,
      name: cube.name,
    }));

  return res.status(200).send({
    success: 'true',
    cubes,
  });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [ensureAuthJson, followedCubesHandler],
  },
];
