import { blogDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  const { lastKey, owner } = req.body;
  const posts = await blogDao.queryByOwner(owner, lastKey, 10);

  return res.status(200).send({
    success: 'true',
    posts: posts.items,
    lastKey: posts.lastKey,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
