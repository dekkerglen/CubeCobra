#!/usr/bin/env node

/**
 * Helper script to trigger ECS jobs from the command line
 *
 * Usage:
 *   node trigger-job.js update-cards --env beta
 *   node trigger-job.js update-all --env production
 */

const { ECSClient, RunTaskCommand, DescribeTasksCommand } = require('@aws-sdk/client-ecs');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

const JOB_COMMANDS = {
  'update-cards': ['npm', 'run', 'update-cards'],
  'update-combos': ['npm', 'run', 'update-combos'],
  'update-metadata-dict': ['npm', 'run', 'update-metadata-dict'],
  'update-cube-history': ['npm', 'run', 'update-cube-history'],
  'update-draft-history': ['npm', 'run', 'update-draft-history'],
  'update-all': ['npm', 'run', 'update-all'],
};

const STACK_NAMES = {
  beta: 'CubeCobra-Beta',
  production: 'CubeCobra-Production',
};

async function getStackOutputs(stackName) {
  const cfnClient = new CloudFormationClient({ region: 'us-east-2' });
  const command = new DescribeStacksCommand({ StackName: stackName });
  const response = await cfnClient.send(command);

  const outputs = {};
  for (const output of response.Stacks[0].Outputs || []) {
    outputs[output.OutputKey] = output.OutputValue;
  }
  return outputs;
}

async function runJob(jobName, environment) {
  if (!JOB_COMMANDS[jobName]) {
    console.error(`Unknown job: ${jobName}`);
    console.error(`Available jobs: ${Object.keys(JOB_COMMANDS).join(', ')}`);
    process.exit(1);
  }

  const stackName = STACK_NAMES[environment];
  if (!stackName) {
    console.error(`Unknown environment: ${environment}`);
    console.error(`Available environments: ${Object.keys(STACK_NAMES).join(', ')}`);
    process.exit(1);
  }

  console.log(`Fetching stack outputs for ${stackName}...`);
  const outputs = await getStackOutputs(stackName);

  const clusterName = outputs['JobsClusterName'];
  const taskDefinitionArn = outputs['JobsTaskDefinitionArn'];

  if (!clusterName || !taskDefinitionArn) {
    console.error('Could not find required stack outputs (JobsClusterName, JobsTaskDefinitionArn)');
    process.exit(1);
  }

  console.log(`Cluster: ${clusterName}`);
  console.log(`Task Definition: ${taskDefinitionArn}`);
  console.log(`Job: ${jobName}`);
  console.log(`Command: ${JOB_COMMANDS[jobName].join(' ')}`);

  const ecsClient = new ECSClient({ region: 'us-east-2' });

  // Note: You'll need to configure the network settings based on your VPC setup
  // For now, this uses the default VPC configuration
  const command = new RunTaskCommand({
    cluster: clusterName,
    taskDefinition: taskDefinitionArn,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        // You'll need to specify your subnets and security groups here
        // These can also be retrieved from stack outputs if you add them
        subnets: [], // Add your subnet IDs
        securityGroups: [], // Add your security group IDs
        assignPublicIp: 'ENABLED',
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: 'JobsContainer',
          command: JOB_COMMANDS[jobName],
        },
      ],
    },
  });

  console.log('\nStarting task...');
  const response = await ecsClient.send(command);

  if (response.failures && response.failures.length > 0) {
    console.error('Failed to start task:');
    for (const failure of response.failures) {
      console.error(`  ${failure.reason}: ${failure.detail}`);
    }
    process.exit(1);
  }

  const taskArn = response.tasks[0].taskArn;
  const taskId = taskArn.split('/').pop();

  console.log(`\nTask started successfully!`);
  console.log(`Task ARN: ${taskArn}`);
  console.log(`Task ID: ${taskId}`);
  console.log(`\nView logs at:`);
  console.log(
    `https://console.aws.amazon.com/cloudwatch/home?region=us-east-2#logsV2:log-groups/log-group/$252Fecs$252Fcubecobra-jobs/log-events/jobs$252FJobsContainer$252F${taskId}`,
  );
  console.log(`\nOr with AWS CLI:`);
  console.log(`aws logs tail /ecs/cubecobra-jobs --follow --filter-pattern "${taskId}"`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const jobName = args[0];
const envIndex = args.indexOf('--env');
const environment = envIndex >= 0 ? args[envIndex + 1] : 'beta';

if (!jobName) {
  console.error('Usage: node trigger-job.js <job-name> [--env <environment>]');
  console.error(`\nAvailable jobs: ${Object.keys(JOB_COMMANDS).join(', ')}`);
  console.error(`Available environments: ${Object.keys(STACK_NAMES).join(', ')}`);
  process.exit(1);
}

runJob(jobName, environment).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
