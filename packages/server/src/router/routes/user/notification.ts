import { NotificationStatus } from '@utils/datatypes/Notification';
import Notification from 'dynamo/models/notification';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid notification ID');
      return redirect(req, res, '/404');
    }

    const notification = await Notification.getById(req.params.id);

    if (!notification) {
      req.flash('danger', 'Not Found');
      return redirect(req, res, '/404');
    }

    if (notification.status === NotificationStatus.UNREAD) {
      notification.status = NotificationStatus.READ;
      await Notification.update(notification);
    }

    return redirect(req, res, notification.url || '/');
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
