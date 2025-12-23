import { notificationDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({
      success: 'false',
      message: 'User not authenticated',
    });
  }

  const { lastKey } = req.body;
  const notifications = await notificationDao.getByTo(`${req.user.id}`, lastKey);

  return res.status(200).send({
    success: 'true',
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
