import { NoticeType } from '@utils/datatypes/Notice';
import Notice from 'dynamo/models/notice';
import User from 'dynamo/models/user';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'User ID required');
      return redirect(req, res, '/404');
    }

    const user = await User.getById(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const report = {
      subject: user.id,
      body: `"${user.username}" was reported by ${req.user?.username || 'Anonymous'}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.CUBE_REPORT,
    };

    await Notice.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report and decide whether to take action.',
    );

    return redirect(req, res, `/user/view/${req.params.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/user/view/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
