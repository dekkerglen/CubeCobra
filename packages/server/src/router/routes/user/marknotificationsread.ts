import { NotificationStatus } from '@utils/datatypes/Notification';
import { notificationDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

// Marks a specific set of notifications read in one shot. Used when a collapsed group row (e.g.
// "There are 3 new drafts of My Cube") is clicked so every notification behind it is cleared at once.
export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'User not authenticated',
      });
    }

    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return res.status(400).send({
        success: 'false',
        message: 'ids must be an array of notification ids',
      });
    }

    const notifications = await Promise.all(ids.map((id: string) => notificationDao.getById(id)));

    // Only touch notifications that belong to the caller and are still unread.
    const toUpdate = notifications.filter(
      (notification) =>
        notification && notification.to === `${req.user!.id}` && notification.status === NotificationStatus.UNREAD,
    );

    if (toUpdate.length > 0) {
      await notificationDao.batchPut(
        toUpdate.map((notification) => ({
          ...notification!,
          status: NotificationStatus.READ,
        })),
      );
    }

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
