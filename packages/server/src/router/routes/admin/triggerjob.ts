import { ECSClient, ListTasksCommand, RunTaskCommand } from '@aws-sdk/client-ecs';
import { CardMetadataTaskStatus } from '@utils/datatypes/CardMetadataTask';
import { CardUpdateTaskStatus } from '@utils/datatypes/CardUpdateTask';
import { ExportTaskStatus } from '@utils/datatypes/ExportTask';
import { MigrationTaskStatus } from '@utils/datatypes/MigrationTask';
import { UserRoles } from '@utils/datatypes/User';
import { cardMetadataTaskDao, cardUpdateTaskDao, exportTaskDao, migrationTaskDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';

import { Request, Response } from '../../../types/express';

interface JobConfig {
  command: string[];
  envVarName: string;
  createTask: () => Promise<{ id: string; taskArn?: string; step?: string; dateLastUpdated?: number }>;
  saveTaskArn: (task: { id: string; taskArn?: string; step?: string; dateLastUpdated?: number }, taskArn: string) => Promise<void>;
}

const JOB_CONFIGS: Record<string, JobConfig> = {
  'card-update': {
    command: ['npm', 'run', 'update-all'],
    envVarName: 'CARD_UPDATE_TASK_ID',
    createTask: () =>
      cardUpdateTaskDao.create({
        status: CardUpdateTaskStatus.IN_PROGRESS,
        checksum: '',
        scryfallUpdatedAt: new Date().toISOString(),
        scryfallFileSize: 0,
        cardsAdded: 0,
        totalCards: 0,
        step: 'Initializing (manual trigger)',
      }),
    saveTaskArn: async (task, taskArn) => {
      task.taskArn = taskArn;
      task.step = 'Starting Job';
      task.dateLastUpdated = Date.now();
      await cardUpdateTaskDao.update(task as any);
    },
  },
  'card-metadata': {
    command: ['npm', 'run', 'update-metadata-dict'],
    envVarName: 'CARD_METADATA_TASK_ID',
    createTask: () =>
      cardMetadataTaskDao.create({
        status: CardMetadataTaskStatus.IN_PROGRESS,
        step: 'Initializing (manual trigger)',
      }),
    saveTaskArn: async (task, taskArn) => {
      task.taskArn = taskArn;
      task.step = 'Starting Job';
      task.dateLastUpdated = Date.now();
      await cardMetadataTaskDao.update(task as any);
    },
  },
  export: {
    command: ['npm', 'run', 'export-all'],
    envVarName: 'EXPORT_TASK_ID',
    createTask: () =>
      exportTaskDao.create({
        status: ExportTaskStatus.IN_PROGRESS,
        exportType: 'all_data',
        fileSize: 0,
        step: 'Initializing (manual trigger)',
      }),
    saveTaskArn: async (task, taskArn) => {
      task.taskArn = taskArn;
      task.step = 'Starting Job';
      task.dateLastUpdated = Date.now();
      await exportTaskDao.update(task as any);
    },
  },
  migration: {
    command: ['npm', 'run', 'apply-migrations'],
    envVarName: 'MIGRATION_TASK_ID',
    createTask: () =>
      migrationTaskDao.create({
        status: MigrationTaskStatus.IN_PROGRESS,
        lastMigrationDate: new Date().toISOString(),
        migrationsProcessed: 0,
        cubesAffected: 0,
        cardsDeleted: 0,
        cardsMerged: 0,
        step: 'Initializing (manual trigger)',
      }),
    saveTaskArn: async (task, taskArn) => {
      task.taskArn = taskArn;
      task.step = 'Starting Job';
      task.dateLastUpdated = Date.now();
      await migrationTaskDao.update(task as any);
    },
  },
};

const VALID_JOB_TYPES = Object.keys(JOB_CONFIGS);

const triggerJobHandler = async (req: Request, res: Response) => {
  try {
    const { jobType } = req.body;

    if (!jobType || !VALID_JOB_TYPES.includes(jobType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid job type. Must be one of: ${VALID_JOB_TYPES.join(', ')}`,
      });
    }

    const clusterName = process.env.ECS_CLUSTER_NAME;
    const taskDefinitionArn = process.env.ECS_TASK_DEFINITION_ARN;
    const subnetIds = process.env.ECS_SUBNET_IDS?.split(',') || [];
    const assignPublicIp = (process.env.ECS_ASSIGN_PUBLIC_IP as 'ENABLED' | 'DISABLED') || 'DISABLED';

    if (!clusterName || !taskDefinitionArn) {
      return res.status(500).json({
        success: false,
        error: 'ECS not configured on this server. Missing ECS_CLUSTER_NAME or ECS_TASK_DEFINITION_ARN.',
      });
    }

    const ecsClient = new ECSClient({ region: process.env.AWS_REGION || 'us-east-2' });

    // Check if any task is already running
    const taskFamily = taskDefinitionArn.split('/')[1]?.split(':')[0];
    if (taskFamily) {
      const listResponse = await ecsClient.send(
        new ListTasksCommand({
          cluster: clusterName,
          family: taskFamily,
          desiredStatus: 'RUNNING',
        }),
      );

      if (listResponse.taskArns && listResponse.taskArns.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'An ECS job is already running. Please wait for it to finish before starting another.',
        });
      }
    }

    const config = JOB_CONFIGS[jobType];
    if (!config) {
      return res.status(400).json({ success: false, error: 'Invalid job type' });
    }

    // Create a task record in DynamoDB
    const task = await config.createTask();

    // Start the ECS task
    const runResponse = await ecsClient.send(
      new RunTaskCommand({
        cluster: clusterName,
        taskDefinition: taskDefinitionArn,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: subnetIds,
            securityGroups: [],
            assignPublicIp,
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'JobsContainer',
              command: config.command,
              environment: [
                {
                  name: config.envVarName,
                  value: task.id,
                },
              ],
            },
          ],
        },
      }),
    );

    if (!runResponse.tasks || runResponse.tasks.length === 0) {
      return res.status(500).json({
        success: false,
        error: `Failed to start ECS task: ${JSON.stringify(runResponse.failures)}`,
      });
    }

    const taskArn = runResponse.tasks[0]?.taskArn || '';

    // Save the taskArn back to DynamoDB so the monitor lambda can track ECS health
    try {
      await config.saveTaskArn(task, taskArn);
    } catch (updateError) {
      console.error('Failed to save taskArn to DynamoDB:', updateError);
      // Don't fail the request - the ECS task is already running
    }

    return res.status(200).json({
      success: true,
      taskId: task.id,
      taskArn,
      jobType,
    });
  } catch (error) {
    console.error('Error triggering job:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), triggerJobHandler],
  },
];
