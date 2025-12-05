import Cube from 'dynamo/models/cube';
import User from 'dynamo/models/user';
import { handleRouteError, render } from 'serverutils/render';
import { csrfProtection, ensureAuth } from 'src/router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({ success: 'false', message: 'User not authenticated' });
    }

    const followedCubes = (await Cube.batchGet(req.user.followedCubes || [])).filter(
      (cube: any) => cube.visibility !== 'pr',
    );
    const followers = await User.batchGet(req.user.following || []);
    const followedUsers = await User.batchGet(req.user.followedUsers || []);

    return render(
      req,
      res,
      'UserSocialPage',
      {
        followedCubes,
        followedUsers,
        followers,
      },
      {
        title: 'Social',
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/');
  }
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
