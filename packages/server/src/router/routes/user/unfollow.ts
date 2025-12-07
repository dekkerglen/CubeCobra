import User from 'dynamo/models/user';
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

    const other = await User.getById(req.params.id);

    if (!other) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    other.following = (other.following || []).filter((id) => user.id !== id);
    user.followedUsers = (user.followedUsers || []).filter((id) => id !== req.params.id);

    await User.batchPut([user, other]);

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
