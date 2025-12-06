import User from 'dynamo/models/user';
import { redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    const { user } = req;

    if (!user || !req.params.id) {
      req.flash('danger', 'Invalid request');
      return redirect(req, res, '/404');
    }

    const other = await User.getById(req.params.id);

    if (!other) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    if (!(other.following || []).some((id) => id === user.id)) {
      if (!other.following) {
        other.following = [];
      }
      other.following.push(user.id);
    }
    if (!(user.followedUsers || []).some((id) => id === other.id)) {
      if (!user.followedUsers) {
        user.followedUsers = [];
      }
      user.followedUsers.push(other.id);
    }

    await addNotification(other, user, `/user/view/${user.id}`, `${user.username} has followed you!`);

    await User.batchPut([other, user]);

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
    method: 'get',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
