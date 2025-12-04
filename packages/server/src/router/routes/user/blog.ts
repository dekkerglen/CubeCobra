import Blog from 'dynamo/models/blog';
import User from 'dynamo/models/user';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.userid) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await User.getByIdOrUsername(req.params.userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const posts = await Blog.getByOwner(req.params.userid, 10);

    return render(
      req,
      res,
      'UserBlogPage',
      {
        owner: user,
        posts: posts.items,
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
