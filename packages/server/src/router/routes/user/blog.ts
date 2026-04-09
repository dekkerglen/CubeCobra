import { blogDao, userDao } from 'dynamo/daos';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.userid) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await userDao.getByIdOrUsername(req.params.userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const posts = await blogDao.queryByOwner(req.params.userid, undefined, 10);

    // Filter out blog posts from private/unlisted cubes unless the viewer is the owner
    const { CUBE_VISIBILITY } = await import('@utils/datatypes/Cube');
    const filteredPosts = posts.items.filter((post) => {
      // DEVLOG posts are always visible
      if (post.cube === 'DEVBLOG') {
        return true;
      }
      // Only show blog posts from public cubes on user blog pages
      // Private and unlisted cube blogs should not be discoverable here
      if (post.cubeVisibility !== CUBE_VISIBILITY.PUBLIC) {
        return req.user && (req.user.id === user.id || req.user.id === post.owner.id);
      }
      return true;
    });

    return render(
      req,
      res,
      'UserBlogPage',
      {
        owner: user,
        posts: filteredPosts,
        lastKey: posts.lastKey,
        followersCount: (user.following || []).length,
        following: req.user && (req.user.followedUsers || []).some((id) => id === user.id),
      },
      {
        title: user.username,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:userid',
    method: 'get',
    handler: [handler],
  },
];
