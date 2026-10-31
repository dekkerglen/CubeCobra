import { userDao } from 'dynamo/daos';
import { csrfProtection } from 'router/middleware';
import { getCollaborationsPage } from 'serverutils/collaborations';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  const { owner, offset } = req.body;

  const user = await userDao.getById(owner);
  if (!user) {
    return res.status(404).send({
      success: 'false',
      message: 'User not found',
    });
  }

  const page = await getCollaborationsPage(user.id, req.user, Number(offset) || 0);

  return res.status(200).send({
    success: 'true',
    cubes: page.cubes,
    nextOffset: page.nextOffset,
    hasMore: page.hasMore,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, handler],
  },
];
