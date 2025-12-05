import Blog from 'dynamo/models/blog';
import { csrfProtection, ensureAuth } from 'src/router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  const { lastKey, owner } = req.body;
  const posts = await Blog.getByOwner(owner, 10, lastKey);

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
