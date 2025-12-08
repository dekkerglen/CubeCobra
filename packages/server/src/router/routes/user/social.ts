import { cubeDao } from 'dynamo/daos';
import User from 'dynamo/models/user';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { handleRouteError, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({ success: 'false', message: 'User not authenticated' });
    }

    const followedCubes = (await cubeDao.batchGet(req.user.followedCubes || [])).filter(
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
