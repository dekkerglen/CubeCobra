import Notification from 'dynamo/models/notification';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return redirect(req, res, '/user/login');
  }

  const notifications = await Notification.getByTo(`${req.user.id}`);

  return render(req, res, 'NotificationsPage', {
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
};

export const routes = [
  {
    path: '/',
    method: 'get',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
