import { monitorCardMetadataTasks } from './cardMetadataTasks';
import { monitorCardUpdates } from './cardUpdates';
import { monitorExportTasks } from './exportTasks';
import { monitorMigrationTasks } from './migrationTasks';

export const handler = async (event: any) => {
  console.log('Card update, export, and migration monitor triggered', { event });

  try {
    // Monitor card updates
    await monitorCardUpdates();

    // Monitor card metadata tasks
    await monitorCardMetadataTasks();

    // Monitor export tasks
    await monitorExportTasks();

    // Monitor migration tasks
    await monitorMigrationTasks();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Monitoring completed',
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in monitoring:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in monitoring',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
