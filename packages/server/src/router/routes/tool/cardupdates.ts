import { cardMetadataTaskDao, cardUpdateTaskDao, exportTaskDao, migrationTaskDao } from 'dynamo/daos';
import { handleRouteError, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const getCardUpdatesHandler = async (req: Request, res: Response) => {
  try {
    // Get recent tasks and find the last successful one of each type
    const { items: allCardUpdates } = await cardUpdateTaskDao.listAll(10);
    const { items: allCardMetadataTasks } = await cardMetadataTaskDao.listAll(10);
    const { items: allExportTasks } = await exportTaskDao.listAll(10);
    const { items: allMigrationTasks } = await migrationTaskDao.listAll(10);

    const lastCardUpdate = allCardUpdates.find((task) => task.status === 'COMPLETED');
    const lastCardMetadataTask = allCardMetadataTasks.find((task) => task.status === 'COMPLETED');
    const lastExportTask = allExportTasks.find((task) => task.status === 'COMPLETED');
    const lastMigrationTask = allMigrationTasks.find((task) => task.status === 'COMPLETED');

    return render(
      req,
      res,
      'CardUpdatesPage',
      {
        lastCardUpdate,
        lastCardMetadataTask,
        lastExportTask,
        lastMigrationTask,
      },
      {
        title: 'Card Database Status',
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [getCardUpdatesHandler],
  },
];
