import { UserRoles } from '@utils/datatypes/User';
import { cardMetadataTaskDao, cardUpdateTaskDao, exportTaskDao, migrationTaskDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';

import { Request, Response } from '../../../types/express';

export const getCardUpdatesDataHandler = async (req: Request, res: Response) => {
  try {
    // Get the last 10 card updates (all statuses)
    const { items: cardUpdates } = await cardUpdateTaskDao.listAll(10);

    // Get the last 10 card metadata tasks (all statuses)
    const { items: cardMetadataTasks } = await cardMetadataTaskDao.listAll(10);

    // Get the last 10 export tasks (all statuses)
    const { items: exportTasks } = await exportTaskDao.listAll(10);

    // Get the last 10 migration tasks (all statuses)
    const { items: migrationTasks } = await migrationTaskDao.listAll(10);

    return res.status(200).json({
      success: true,
      cardUpdates,
      cardMetadataTasks,
      exportTasks,
      migrationTasks,
    });
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('cardupdates')],
  },
  {
    method: 'get',
    path: '/data',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), getCardUpdatesDataHandler],
  },
];
