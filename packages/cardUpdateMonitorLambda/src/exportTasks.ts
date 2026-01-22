import { exportTaskDao } from '@server/dynamo/daos';
import { ExportTaskStatus } from '@utils/datatypes/ExportTask';

import { checkEcsTaskHealth, isTaskRunning, startEcsTask } from './utils/ecs';

/**
 * Monitor export tasks
 */
export async function monitorExportTasks(): Promise<void> {
  console.log('Starting export task monitoring...');

  // Get the most recent task
  const mostRecentTask = await exportTaskDao.getMostRecent();

  // Check if there's an active task
  if (mostRecentTask && mostRecentTask.status === ExportTaskStatus.IN_PROGRESS) {
    console.log(`Active export task found: ${mostRecentTask.id}, step: ${mostRecentTask.step}`);

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
          console.log(`Export task ${mostRecentTask.id} completed successfully`);
          // Mark as completed in case the task didn't update itself
          await exportTaskDao.markAsCompleted(mostRecentTask.id);
        } else {
          console.log(`Export task ${mostRecentTask.id} failed with exit code ${health.exitCode}`);
          await exportTaskDao.markAsFailed(mostRecentTask.id, `Export job failed. Exit code: ${health.exitCode}`);
        }
      } else if (health.isRunning) {
        console.log(`Export task ${mostRecentTask.id} is still running`);
      } else {
        // Task is stopped but not running and hasn't exited - this can happen with ECS
        // Check if task has been running for a reasonable amount of time and mark as complete
        const taskAge = Date.now() - (mostRecentTask.startedAt || mostRecentTask.timestamp);
        const minTaskDuration = 5 * 60 * 1000; // 5 minutes minimum

        if (taskAge > minTaskDuration) {
          console.log(`Export task ${mostRecentTask.id} appears to have stopped, marking as completed`);
          await exportTaskDao.markAsCompleted(mostRecentTask.id);
        } else {
          console.log(`Export task ${mostRecentTask.id} stopped too quickly, may have failed`);
        }
      }
    } else {
      // Fallback to timeout check if no task ARN
      const taskAge = Date.now() - (mostRecentTask.startedAt || mostRecentTask.timestamp);
      const maxTaskDuration = 60 * 60 * 1000; // 1 hour

      if (taskAge > maxTaskDuration) {
        console.log(`Export task ${mostRecentTask.id} has been running for too long, marking as failed`);
        await exportTaskDao.markAsFailed(mostRecentTask.id, 'Task timed out - exceeded maximum duration of 1 hour');
      } else {
        console.log(`Export task ${mostRecentTask.id} is still in progress, continuing to monitor`);
      }
    }

    return;
  }

  console.log('No active export task found, checking if export is needed...');

  // Get the last successful task
  const lastSuccessfulTask = await exportTaskDao.getMostRecentSuccessful();

  // Check if we need to run an export (every 3 months or if never run)
  const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000; // 90 days
  const now = Date.now();

  if (lastSuccessfulTask && now - lastSuccessfulTask.completedAt! < threeMonthsInMs) {
    const nextRunDate = new Date(lastSuccessfulTask.completedAt! + threeMonthsInMs);
    console.log(`Export not needed yet. Next run scheduled for: ${nextRunDate.toISOString()}`);
    return;
  }

  console.log('Export needed! Creating new export task...');

  // Double-check that no ECS tasks are currently running (safety check)
  const isRunning = await isTaskRunning();
  if (isRunning) {
    console.log('ECS task is already running - aborting to maintain max concurrency of 1');
    return;
  }

  // Create a new IN_PROGRESS task
  const newTask = await exportTaskDao.create({
    status: ExportTaskStatus.IN_PROGRESS,
    exportType: 'all_data',
    fileSize: 0,
    totalRecords: 0,
    step: 'Initializing',
  });

  console.log(`Created export task: ${newTask.id}`);

  // Start the ECS task
  const { taskArn, success } = await startEcsTask(newTask.id, ['npm', 'run', 'export-data'], 'EXPORT_TASK_ID');

  if (!success) {
    console.error('Failed to start ECS task, marking task as failed');
    await exportTaskDao.markAsFailed(newTask.id, 'Failed to start export job');
    return;
  }

  console.log(`Export task started successfully: ${taskArn}`);

  // Store the task ARN for health monitoring
  newTask.taskArn = taskArn;
  newTask.step = 'Starting Job';
  newTask.dateLastUpdated = Date.now();
  await exportTaskDao.update(newTask);
}
