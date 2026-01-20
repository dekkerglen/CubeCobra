import {
  DescribeTasksCommand,
  DescribeTasksCommandOutput,
  ECSClient,
  ListTasksCommand,
  RunTaskCommand,
} from '@aws-sdk/client-ecs';

export const ecsClient = new ECSClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Check if any tasks are currently running in ECS
 */
export async function isTaskRunning(): Promise<boolean> {
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
 * Check the health of an ECS task
 */
export async function checkEcsTaskHealth(
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
 * Start an ECS task with the given configuration
 */
export async function startEcsTask(
  taskId: string,
  command: string[],
  envVarName: string,
): Promise<{ taskArn: string; success: boolean }> {
  const clusterName = process.env.ECS_CLUSTER_NAME;
  const taskDefinitionArn = process.env.ECS_TASK_DEFINITION_ARN;
  const subnetIds = process.env.ECS_SUBNET_IDS?.split(',') || [];
  const securityGroupIds = process.env.ECS_SECURITY_GROUP_IDS?.split(',') || [];
  const assignPublicIp = (process.env.ECS_ASSIGN_PUBLIC_IP as 'ENABLED' | 'DISABLED') || 'DISABLED';

  if (!clusterName || !taskDefinitionArn) {
    throw new Error('ECS_CLUSTER_NAME or ECS_TASK_DEFINITION_ARN not configured');
  }

  try {
    const runCommand = new RunTaskCommand({
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
            command,
            environment: [
              {
                name: envVarName,
                value: taskId,
              },
            ],
          },
        ],
      },
    });

    const response = await ecsClient.send(runCommand);

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
