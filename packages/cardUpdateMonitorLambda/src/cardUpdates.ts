import { GetObjectCommand, S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { cardUpdateTaskDao } from '@server/dynamo/daos';
import { CardUpdateTaskStatus } from '@utils/datatypes/CardUpdateTask';

import { checkEcsTaskHealth, isTaskRunning, startEcsTask } from './utils/ecs';

interface ScryfallBulkData {
  data: Array<{
    type: string;
    download_uri: string;
    updated_at: string;
    size: number;
  }>;
}

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
 * Check Scryfall API for the current file size of all_cards
 */
async function checkScryfallFileSize(): Promise<{ size: number; updatedAt: string } | null> {
  try {
    const response = await fetch('https://api.scryfall.com/bulk-data');
    if (!response.ok) {
      console.error(`Failed to fetch Scryfall bulk data: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as ScryfallBulkData;
    const allCardsData = data.data.find((item) => item.type === 'all_cards');

    if (!allCardsData) {
      console.error('all_cards data not found in Scryfall bulk-data response');
      return null;
    }

    return {
      size: allCardsData.size,
      updatedAt: allCardsData.updated_at,
    };
  } catch (error) {
    console.error('Error checking Scryfall file size:', error);
    return null;
  }
}

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
 * Monitor card update tasks
 */
export async function monitorCardUpdates(): Promise<void> {
  console.log('Starting card update monitoring...');

  // Get the most recent task
  const mostRecentTask = await cardUpdateTaskDao.getMostRecent();

  // Check if there's an active task
  if (mostRecentTask && mostRecentTask.status === CardUpdateTaskStatus.IN_PROGRESS) {
    console.log(`Active task found: ${mostRecentTask.id}, step: ${mostRecentTask.step}`);

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
          console.log(`Task ${mostRecentTask.id} completed successfully`);
          // Note: The actual completion should be handled by the job itself
          // This is just for monitoring
        } else {
          console.log(`Task ${mostRecentTask.id} failed with exit code ${health.exitCode}`);
          await cardUpdateTaskDao.markAsFailed(
            mostRecentTask.id,
            `Card update job failed. Exit code: ${health.exitCode}`,
          );
        }
      } else if (health.isRunning) {
        console.log(`Task ${mostRecentTask.id} is still running`);
      }
    } else {
      // Fallback to timeout check if no task ARN
      const taskAge = Date.now() - (mostRecentTask.startedAt || mostRecentTask.timestamp);
      const maxTaskDuration = 60 * 60 * 1000; // 1 hour

      if (taskAge > maxTaskDuration) {
        console.log(`Task ${mostRecentTask.id} has been running for too long, marking as failed`);
        await cardUpdateTaskDao.markAsFailed(mostRecentTask.id, 'Task timed out - exceeded maximum duration of 1 hour');
      } else {
        console.log(`Task ${mostRecentTask.id} is still in progress, continuing to monitor`);
      }
    }

    return;
  }

  console.log('No active task found, checking for updates...');

  // Check Scryfall for changes
  const scryfallData = await checkScryfallFileSize();
  if (!scryfallData) {
    console.error('Failed to get Scryfall data, exiting');
    return;
  }

  console.log(`Scryfall file size: ${scryfallData.size}, updated at: ${scryfallData.updatedAt}`);

  // Check the production manifest first - this is the source of truth
  // Manual updates or other processes may have already processed this Scryfall version
  const productionManifest = await downloadManifestFromS3();
  if (productionManifest) {
    console.log(
      `Production manifest found: scryfallFileSize=${productionManifest.scryfallFileSize}, totalCards=${productionManifest.totalCards}`,
    );

    // If the production manifest already has this Scryfall file size, no update is needed
    if (productionManifest.scryfallFileSize === scryfallData.size) {
      console.log(`Production manifest already has this Scryfall file size (${scryfallData.size}). No update needed.`);
      return;
    }

    console.log(
      `Production manifest has different Scryfall file size: ${productionManifest.scryfallFileSize} vs ${scryfallData.size}`,
    );
  } else {
    console.log('No production manifest found - this may be the first run');
  }

  // Get the last successful task for additional verification
  const lastSuccessfulTask = await cardUpdateTaskDao.getMostRecentSuccessful();

  // Check if the file size has changed from the last successful task
  if (lastSuccessfulTask && lastSuccessfulTask.scryfallFileSize === scryfallData.size) {
    console.log(
      `Last successful task ${lastSuccessfulTask.id} already processed this Scryfall file size (${lastSuccessfulTask.scryfallFileSize})`,
    );
    // This shouldn't happen if manifest check above passed, but double-check for safety
    return;
  }

  if (lastSuccessfulTask) {
    console.log(
      `Changes detected! Last successful task ${lastSuccessfulTask.id} had size ${lastSuccessfulTask.scryfallFileSize}, current size is ${scryfallData.size}`,
    );
  } else {
    console.log('No previous successful task found, creating initial update task');
  }

  console.log('Changes detected! Creating new update task...');

  // Double-check that no ECS tasks are currently running (safety check)
  const isRunning = await isTaskRunning();
  if (isRunning) {
    console.log('ECS task is already running - aborting to maintain max concurrency of 1');
    return;
  }

  // Create a new IN_PROGRESS task
  const newTask = await cardUpdateTaskDao.create({
    status: CardUpdateTaskStatus.IN_PROGRESS,
    checksum: '', // Will be calculated during the update
    scryfallUpdatedAt: scryfallData.updatedAt,
    scryfallFileSize: scryfallData.size,
    cardsAdded: 0,
    totalCards: 0,
    step: 'Initializing',
  });

  console.log(`Created task: ${newTask.id}`);

  // Start the ECS task
  const { taskArn, success } = await startEcsTask(newTask.id, ['npm', 'run', 'update-all'], 'CARD_UPDATE_TASK_ID');

  if (!success) {
    console.error('Failed to start ECS task, marking task as failed');
    await cardUpdateTaskDao.markAsFailed(newTask.id, 'Failed to start card update job');
    return;
  }

  console.log(`Card update task started successfully: ${taskArn}`);

  // Store the task ARN for health monitoring
  newTask.taskArn = taskArn;
  newTask.step = 'Starting Job';
  newTask.dateLastUpdated = Date.now();
  await cardUpdateTaskDao.update(newTask);
}
