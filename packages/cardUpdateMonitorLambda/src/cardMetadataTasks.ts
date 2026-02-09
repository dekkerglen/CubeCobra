import { GetObjectCommand, S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { cardMetadataTaskDao } from '@server/dynamo/daos';
import { CardMetadataTaskStatus } from '@utils/datatypes/CardMetadataTask';

import { checkEcsTaskHealth, isTaskRunning, startEcsTask } from './utils/ecs';

interface CardManifest {
  checksum: string;
  scryfallUpdatedAt: string;
  scryfallFileSize: number;
  totalCards: number;
  cardsAdded: number;
  version?: string;
  lastMetadataDictUpdate?: string;
}

// Initialize S3 client
const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

/**
 * Download the production card manifest from S3
 */
async function downloadManifestFromS3(): Promise<CardManifest | null> {
  try {
    const bucket = process.env.DATA_BUCKET;
    if (!bucket) {
      console.error('DATA_BUCKET environment variable not set');
      return null;
    }

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: 'cards/manifest.json',
      }),
    );

    if (!response.Body) {
      console.log('No manifest found in S3');
      return null;
    }

    const bodyContents = await response.Body.transformToString();
    return JSON.parse(bodyContents) as CardManifest;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log('Manifest not found in S3 (first run?)');
      return null;
    }
    console.error('Error downloading manifest from S3:', error);
    return null;
  }
}

/**
 * Monitor card metadata tasks
 */
export async function monitorCardMetadataTasks(): Promise<void> {
  console.log('Starting card metadata task monitoring...');

  // Get the most recent task
  const mostRecentTask = await cardMetadataTaskDao.getMostRecent();

  // Check if there's an active task
  if (mostRecentTask && mostRecentTask.status === CardMetadataTaskStatus.IN_PROGRESS) {
    console.log(`Active card metadata task found: ${mostRecentTask.id}, step: ${mostRecentTask.step}`);

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
          console.log(`Card metadata task ${mostRecentTask.id} completed successfully`);
          await cardMetadataTaskDao.markAsCompleted(mostRecentTask.id);
        } else {
          console.log(`Card metadata task ${mostRecentTask.id} failed with exit code ${health.exitCode}`);
          await cardMetadataTaskDao.markAsFailed(
            mostRecentTask.id,
            `Card metadata job failed. Exit code: ${health.exitCode}`,
          );
        }
      } else if (health.isRunning) {
        console.log(`Card metadata task ${mostRecentTask.id} is still running`);
      }
    } else {
      // Fallback to timeout check if no task ARN
      const taskAge = Date.now() - (mostRecentTask.startedAt || mostRecentTask.timestamp);
      const maxTaskDuration = 2 * 60 * 60 * 1000; // 2 hours

      if (taskAge > maxTaskDuration) {
        console.log(`Card metadata task ${mostRecentTask.id} has been running for too long, marking as failed`);
        await cardMetadataTaskDao.markAsFailed(
          mostRecentTask.id,
          'Task timed out - exceeded maximum duration of 2 hours',
        );
      } else {
        console.log(`Card metadata task ${mostRecentTask.id} is still in progress, continuing to monitor`);
      }
    }

    return;
  }

  console.log('No active card metadata task found, checking if update is needed...');

  // Get the last successful task
  const lastSuccessfulTask = await cardMetadataTaskDao.getMostRecentSuccessful();

  // Check if we need to run metadata dict update (once per week)
  const weekInMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();

  // Check the manifest first - it's the source of truth
  const manifest = await downloadManifestFromS3();
  if (manifest && manifest.lastMetadataDictUpdate) {
    const lastManifestUpdate = new Date(manifest.lastMetadataDictUpdate).valueOf();
    if (now - lastManifestUpdate < weekInMs) {
      const daysSinceUpdate = Math.floor((now - lastManifestUpdate) / (24 * 60 * 60 * 1000));
      console.log(
        `Metadata dict was last updated ${daysSinceUpdate} days ago (according to manifest). Skipping update (minimum 7 days).`,
      );
      return;
    }
  }

  // Double-check with the last successful task
  if (lastSuccessfulTask && now - lastSuccessfulTask.completedAt! < weekInMs) {
    const nextRunDate = new Date(lastSuccessfulTask.completedAt! + weekInMs);
    console.log(`Metadata update not needed yet. Next run scheduled for: ${nextRunDate.toISOString()}`);
    return;
  }

  console.log('Metadata update needed! Creating new card metadata task...');

  // Double-check that no ECS tasks are currently running (safety check)
  const isRunning = await isTaskRunning();
  if (isRunning) {
    console.log('ECS task is already running - aborting to maintain max concurrency of 1');
    return;
  }

  // Create a new IN_PROGRESS task
  const newTask = await cardMetadataTaskDao.create({
    status: CardMetadataTaskStatus.IN_PROGRESS,
    step: 'Initializing',
  });

  console.log(`Created card metadata task: ${newTask.id}`);

  // Start the ECS task
  const { taskArn, success } = await startEcsTask(
    newTask.id,
    ['npm', 'run', 'update-metadata-dict'],
    'CARD_METADATA_TASK_ID',
  );

  if (!success) {
    console.error('Failed to start ECS task, marking task as failed');
    await cardMetadataTaskDao.markAsFailed(newTask.id, 'Failed to start card metadata job');
    return;
  }

  console.log(`Card metadata task started successfully: ${taskArn}`);

  // Store the task ARN for health monitoring
  newTask.taskArn = taskArn;
  newTask.step = 'Starting Job';
  newTask.dateLastUpdated = Date.now();
  await cardMetadataTaskDao.update(newTask);
}
