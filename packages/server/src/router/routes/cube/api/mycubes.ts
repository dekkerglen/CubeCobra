import { cubeDao } from 'dynamo/daos';
import { ensureAuthJson } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

/**
 * GET /cube/api/mycubes
 *
 * Returns the full list of cubes owned by the current user, sorted by date
 * last edited (most recent first) with pinned cubes hoisted to the top.
 */
export const mycubesHandler = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const [ownedResult, pinnedResult] = await Promise.all([
    cubeDao.queryByOwner(userId, 'date', false),
    cubeDao.queryCubesPinnedBy(userId, undefined, 200),
  ]);

  const pinnedIds = new Set(pinnedResult.cubeIds);
  const owned = ownedResult.items;
  const pinned = owned.filter((cube) => pinnedIds.has(cube.id));
  const unpinned = owned.filter((cube) => !pinnedIds.has(cube.id));

  const cubes = [...pinned, ...unpinned].map((cube) => ({
    id: cube.id,
    shortId: cube.shortId,
    name: cube.name,
    pinnedByCurrentUser: pinnedIds.has(cube.id),
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
    handler: [ensureAuthJson, mycubesHandler],
  },
];
