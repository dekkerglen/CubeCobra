import { migrationTaskDao } from '@server/dynamo/daos';
import { MigrationTaskStatus } from '@utils/datatypes/MigrationTask';

import { checkEcsTaskHealth, isTaskRunning, startEcsTask } from './utils/ecs';

interface ScryfallMigrationsData {
  has_more: boolean;
  data: Array<{
    id: string;
    performed_at: string;
  }>;
}

/**
 * Check Scryfall API for new migrations since the last successful migration task
 */
async function checkForNewMigrations(lastMigrationDate: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.scryfall.com/migrations?page=1');
    if (!response.ok) {
      console.error(`Failed to fetch Scryfall migrations: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as ScryfallMigrationsData;

    // Check if there are any migrations newer than our last processed date
    const lastDate = new Date(lastMigrationDate);
    const hasMigrations = data.data.some((migration) => new Date(migration.performed_at) > lastDate);

    if (hasMigrations) {
      console.log(`Found new migrations since ${lastMigrationDate}`);
      return true;
    }

    console.log(`No new migrations found since ${lastMigrationDate}`);
    return false;
  } catch (error) {
    console.error('Error checking for Scryfall migrations:', error);
    return false;
  }
}

/**
 * Monitor migration tasks
 */
export async function monitorMigrationTasks(): Promise<void> {
  console.log('Starting migration task monitoring...');

  // Get the most recent task
  const mostRecentTask = await migrationTaskDao.getMostRecent();

  // Check if there's an active task
  if (mostRecentTask && mostRecentTask.status === MigrationTaskStatus.IN_PROGRESS) {
    console.log(`Active migration task found: ${mostRecentTask.id}, step: ${mostRecentTask.step}`);

    // Check ECS task health if we have a task ARN stored
    if (mostRecentTask.taskArn) {
      const clusterName = process.env.ECS_CLUSTER_NAME;
      if (!clusterName) {
        console.error('ECS_CLUSTER_NAME not configured, cannot check task health');
        return;
      }

      const health = await checkEcsTaskHealth(mostRecentTask.taskArn, clusterName);
      console.log(`Task health: running=${health.isRunning}, exited=${health.hasExited}, exitCode=${health.exitCode}`);

      if (health.hasExited) {
        if (health.exitCode === 0) {
          console.log(`Migration task ${mostRecentTask.id} completed successfully`);
          // Note: The actual completion should be handled by the job itself
        } else {
          console.log(`Migration task ${mostRecentTask.id} failed with exit code ${health.exitCode}`);
          await migrationTaskDao.markAsFailed(mostRecentTask.id, `Migration job failed. Exit code: ${health.exitCode}`);
        }
      } else if (health.isRunning) {
        console.log(`Migration task ${mostRecentTask.id} is still running`);
      }
    } else {
      // Fallback to timeout check if no task ARN
      const taskAge = Date.now() - (mostRecentTask.startedAt || mostRecentTask.timestamp);
      const maxTaskDuration = 60 * 60 * 1000; // 1 hour

      if (taskAge > maxTaskDuration) {
        console.log(`Migration task ${mostRecentTask.id} has been running for too long, marking as failed`);
        await migrationTaskDao.markAsFailed(mostRecentTask.id, 'Task timed out - exceeded maximum duration of 1 hour');
      } else {
        console.log(`Migration task ${mostRecentTask.id} is still in progress, continuing to monitor`);
      }
    }

    return;
  }

  console.log('No active migration task found, checking if migrations are needed...');

  // Get the last successful task
  const lastSuccessfulTask = await migrationTaskDao.getMostRecentSuccessful();
  const lastMigrationDate = lastSuccessfulTask?.lastMigrationDate || '2000-01-01T00:00:00.000Z';

  // Check if there are new migrations to process
  const hasNewMigrations = await checkForNewMigrations(lastMigrationDate);

  if (!hasNewMigrations) {
    console.log('No new migrations to process');
    return;
  }

  console.log('New migrations found! Creating migration task...');

  // Double-check that no ECS tasks are currently running (safety check)
  const isRunning = await isTaskRunning();
  if (isRunning) {
    console.log('ECS task is already running - aborting to maintain max concurrency of 1');
    return;
  }

  // Create a new IN_PROGRESS task
  const newTask = await migrationTaskDao.create({
    status: MigrationTaskStatus.PENDING,
    lastMigrationDate: lastMigrationDate,
    migrationsProcessed: 0,
    cubesAffected: 0,
    cardsDeleted: 0,
    cardsMerged: 0,
    step: 'Initializing',
  });

  console.log(`Created migration task: ${newTask.id}`);

  // Start the ECS task
  const { taskArn, success } = await startEcsTask(newTask.id, ['npm', 'run', 'apply-migrations'], 'MIGRATION_TASK_ID');

  if (!success) {
    console.error('Failed to start ECS task, marking task as failed');
    await migrationTaskDao.markAsFailed(newTask.id, 'Failed to start migration job');
    return;
  }

  console.log(`Migration task started successfully: ${taskArn}`);

  // Mark as started and store the task ARN
  await migrationTaskDao.markAsStarted(newTask.id);
  const startedTask = await migrationTaskDao.getById(newTask.id);
  if (startedTask) {
    startedTask.taskArn = taskArn;
    await migrationTaskDao.update(startedTask);
  }
}
