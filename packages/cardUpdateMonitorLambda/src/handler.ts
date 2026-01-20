import {
  DescribeTasksCommand,
  DescribeTasksCommandOutput,
  ECSClient,
  ListTasksCommand,
  RunTaskCommand,
} from '@aws-sdk/client-ecs';
import { cardUpdateTaskDao } from '@server/dynamo/daos';
import { CardUpdateTaskStatus } from '@utils/datatypes/CardUpdateTask';

const ecsClient = new ECSClient({ region: process.env.AWS_REGION || 'us-east-1' });

interface ScryfallBulkData {
  data: Array<{
    type: string;
    download_uri: string;
    updated_at: string;
    size: number;
  }>;
}

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
 * Check if any card update tasks are currently running in ECS
 */
async function isCardUpdateTaskRunning(): Promise<boolean> {
  const clusterName = process.env.ECS_CLUSTER_NAME;
  const taskDefinitionArn = process.env.ECS_TASK_DEFINITION_ARN;

  if (!clusterName || !taskDefinitionArn) {
    console.error('ECS_CLUSTER_NAME or ECS_TASK_DEFINITION_ARN not configured');
    return false;
  }

  try {
    // Get the task family from the ARN (e.g., "cubecobra-jobs" from "arn:...:task-definition/cubecobra-jobs:1")
    const taskFamily = taskDefinitionArn.split('/')[1]?.split(':')[0];
    if (!taskFamily) {
      console.error('Could not extract task family from task definition ARN');
      return false;
    }

    // List all running tasks for this task family
    const command = new ListTasksCommand({
      cluster: clusterName,
      family: taskFamily,
      desiredStatus: 'RUNNING',
    });

    const response = await ecsClient.send(command);
    const runningTaskCount = response.taskArns?.length || 0;

    console.log(`Found ${runningTaskCount} running tasks for family: ${taskFamily}`);
    return runningTaskCount > 0;
  } catch (error) {
    console.error('Error checking for running tasks:', error);
    return false;
  }
}

/**
 * Start an ECS task to run the card update job
 */
async function startCardUpdateTask(taskId: string): Promise<{ taskArn: string; success: boolean }> {
  const clusterName = process.env.ECS_CLUSTER_NAME;
  const taskDefinitionArn = process.env.ECS_TASK_DEFINITION_ARN;
  const subnetIds = process.env.ECS_SUBNET_IDS?.split(',') || [];
  const securityGroupIds = process.env.ECS_SECURITY_GROUP_IDS?.split(',') || [];
  const assignPublicIp = (process.env.ECS_ASSIGN_PUBLIC_IP as 'ENABLED' | 'DISABLED') || 'DISABLED';

  if (!clusterName || !taskDefinitionArn) {
    throw new Error('ECS_CLUSTER_NAME or ECS_TASK_DEFINITION_ARN not configured');
  }

  try {
    const command = new RunTaskCommand({
      cluster: clusterName,
      taskDefinition: taskDefinitionArn,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnetIds,
          securityGroups: securityGroupIds,
          assignPublicIp,
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'JobsContainer',
            command: ['npm', 'run', 'update-all'],
            environment: [
              {
                name: 'CARD_UPDATE_TASK_ID',
                value: taskId,
              },
            ],
          },
        ],
      },
    });

    const response = await ecsClient.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      console.error('Failed to start ECS task:', response.failures);
      return { taskArn: '', success: false };
    }

    const taskArn = response.tasks[0].taskArn || '';
    console.log(`Started ECS task: ${taskArn}`);

    return { taskArn, success: true };
  } catch (error) {
    console.error('Error starting ECS task:', error);
    return { taskArn: '', success: false };
  }
}

/**
 * Check the health of an ECS task
 */
async function checkEcsTaskHealth(
  taskArn: string,
  clusterName: string,
): Promise<{ isRunning: boolean; hasExited: boolean; exitCode?: number }> {
  try {
    const command = new DescribeTasksCommand({
      cluster: clusterName,
      tasks: [taskArn],
    });

    const response: DescribeTasksCommandOutput = await ecsClient.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      console.error('Task not found');
      return { isRunning: false, hasExited: true };
    }

    const task = response.tasks[0];
    const lastStatus = task.lastStatus || '';
    const isRunning = lastStatus === 'RUNNING';
    const hasExited = lastStatus === 'STOPPED' || lastStatus === 'DEPROVISIONING';

    // Get exit code from the first container
    let exitCode: number | undefined;
    if (task.containers && task.containers.length > 0) {
      exitCode = task.containers[0].exitCode;
    }

    return { isRunning, hasExited, exitCode };
  } catch (error) {
    console.error('Error checking ECS task health:', error);
    return { isRunning: false, hasExited: true };
  }
}

/**
 * Main monitoring function
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

  // Get the last successful task
  const lastSuccessfulTask = mostRecentTask?.status === CardUpdateTaskStatus.COMPLETED ? mostRecentTask : null;

  // Check if the file size has changed
  if (lastSuccessfulTask && lastSuccessfulTask.scryfallFileSize === scryfallData.size) {
    console.log('No changes detected in Scryfall data');
    return;
  }

  console.log('Changes detected! Creating new update task...');

  // Double-check that no ECS tasks are currently running (safety check)
  const isRunning = await isCardUpdateTaskRunning();
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
    cardsRemoved: 0,
    totalCards: 0,
    step: 'Initializing',
  });

  console.log(`Created task: ${newTask.id}`);

  // Start the ECS task
  const { taskArn, success } = await startCardUpdateTask(newTask.id);

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

export const handler = async (event: any) => {
  console.log('Card update monitor triggered', { event });

  try {
    await monitorCardUpdates();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Card update monitoring completed',
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in card update monitoring:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in card update monitoring',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
