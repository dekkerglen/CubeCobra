import { NotificationStatus } from '@utils/datatypes/Notification';
import { safeRelativePath } from '@utils/safeUrl';
import { notificationDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid notification ID');
      return redirect(req, res, '/404');
    }

    const notification = await notificationDao.getById(req.params.id);

    // Someone else's notification gets the same answer as a missing one.
    if (!notification || notification.to !== req.user?.id) {
      req.flash('danger', 'Not Found');
      return redirect(req, res, '/404');
    }

    if (notification.status === NotificationStatus.UNREAD) {
      notification.status = NotificationStatus.READ;
      await notificationDao.update(notification);
    }

    // Notification URLs are always paths on this site; never follow one anywhere else.
    return redirect(req, res, safeRelativePath(notification.url) ?? '/');
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({
      success: 'false',
      message: err,
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
