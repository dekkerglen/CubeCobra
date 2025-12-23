import { NotificationStatus } from '@utils/datatypes/Notification';
import { notificationDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'User not authenticated',
      });
    }

    let items, lastKey;

    do {
      const result = await notificationDao.getByToAndStatus(`${req.user.id}`, NotificationStatus.UNREAD, lastKey);

      items = result.items;
      lastKey = result.lastKey;

      if (items) {
        await notificationDao.batchPut(
          items.map((notification) => ({
            ...notification,
            status: NotificationStatus.READ,
          })),
        );
      }
    } while (lastKey);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).send({
      success: 'false',
    });
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
