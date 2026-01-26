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
  const cubes = result.items.filter((cube: any) => isCubeListed(cube, req.user));

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
