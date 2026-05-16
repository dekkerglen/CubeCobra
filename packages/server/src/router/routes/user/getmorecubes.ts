import { cubeDao, userDao } from 'dynamo/daos';
import { csrfProtection } from 'router/middleware';
import { isCubeListed } from 'serverutils/cubefn';
import { getCubesSortValues } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  const { lastKey, owner } = req.body;

  const user = await userDao.getById(owner);
  if (!user) {
    return res.status(404).send({
      success: 'false',
      message: 'User not found',
    });
  }

  const { sort, ascending } = getCubesSortValues(user);
  const result = await cubeDao.queryByOwner(owner, sort, ascending, lastKey || undefined, 36);

  // Filter by listing visibility
  let cubes = result.items.filter((cube: any) => isCubeListed(cube, req.user));

  // The owner's pinned cubes are hoisted onto the first page (see user/view.ts);
  // drop them from later pages so they don't appear twice.
  if (req.user && req.user.id === owner) {
    const pinnedResult = await cubeDao.queryCubesPinnedBy(owner, undefined, 200);
    const pinnedIds = new Set(pinnedResult.cubeIds);
    cubes = cubes.filter((cube: any) => !pinnedIds.has(cube.id));
  }

  return res.status(200).send({
    success: 'true',
    cubes,
    lastKey: result.lastKey,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, handler],
  },
];
