import { blogDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  const { lastKey, owner } = req.body;
  const posts = await blogDao.queryByOwner(owner, lastKey, 10);

  // Filter out blog posts from private cubes unless the viewer is the owner
  const { CUBE_VISIBILITY } = await import('@utils/datatypes/Cube');
  const filteredPosts = posts.items.filter((post) => {
    // DEVLOG posts are always visible
    if (post.cube === 'DEVBLOG') {
      return true;
    }
    // If the cube is private, only show to the owner
    if (post.cubeVisibility === CUBE_VISIBILITY.PRIVATE) {
      return req.user && (req.user.id === owner || req.user.id === post.owner.id);
    }
    // All other cubes (public, unlisted) are visible
    return true;
  });

  return res.status(200).send({
    success: 'true',
    posts: filteredPosts,
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
