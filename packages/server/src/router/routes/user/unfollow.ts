import { userDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const { user } = req;

    if (!user || !req.params.id) {
      req.flash('danger', 'Invalid request');
      return redirect(req, res, '/404');
    }

    const other = await userDao.getById(req.params.id);

    if (!other) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const stillFollowing = await userDao.getFollow(user.id, other.id);
    if (stillFollowing) {
      await userDao.deleteFollow(user.id, other.id);
      await userDao.incrementFollowerCount(other.id, -1);
      await userDao.incrementFollowingCount(user.id, -1);
    }

    return redirect(req, res, `/user/view/${req.params.id}`);
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({
      success: 'false',
    });
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
