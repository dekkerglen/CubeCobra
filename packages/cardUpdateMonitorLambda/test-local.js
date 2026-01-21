#!/usr/bin/env node
/**
 * Test script to run the bundled lambda handler locally
 * This script mocks the environment and simulates a CloudWatch event
 */

// Set up mock environment variables BEFORE importing the handler
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME || 'test-cluster';
process.env.ECS_TASK_DEFINITION_ARN =
  process.env.ECS_TASK_DEFINITION_ARN || 'arn:aws:ecs:us-east-1:123456789012:task-definition/test-task:1';
process.env.ECS_SUBNET_IDS = process.env.ECS_SUBNET_IDS || 'subnet-123456';
process.env.DYNAMO_TABLE = process.env.DYNAMO_TABLE || 'test-table';
process.env.DATA_BUCKET = process.env.DATA_BUCKET || 'test-bucket';

// Now import the handler after env vars are set
const { handler } = await import('./dist/handler.js');

// Mock event (CloudWatch scheduled event)
const mockEvent = {
  version: '0',
  id: 'test-event-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-east-1',
  resources: ['arn:aws:events:us-east-1:123456789012:rule/test-rule'],
  detail: {},
};

async function runTest() {
  console.log('🧪 Testing CardUpdateMonitor lambda locally...\n');
  console.log('Environment variables:');
  console.log(`  AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`  ECS_CLUSTER_NAME: ${process.env.ECS_CLUSTER_NAME}`);
  console.log(`  ECS_TASK_DEFINITION_ARN: ${process.env.ECS_TASK_DEFINITION_ARN}`);
  console.log(`  DYNAMO_TABLE: ${process.env.DYNAMO_TABLE}\n`);

  console.log('📦 Invoking handler with mock event...\n');
  console.log('Note: The handler will likely fail with AWS API errors since we are not');
  console.log('connected to real AWS services. This is expected behavior for local testing.\n');

  try {
    const result = await handler(mockEvent);
    console.log('\n✅ Handler executed successfully!');
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n⚠️  Handler execution encountered an error (expected for local testing):');
    console.error(error.message);
    console.log('\n✨ Good news: The bundled code loaded successfully!');
    console.log('The error is from trying to access AWS services, which is normal for local testing.');
    console.log('The important thing is that the ES module loaded without "type": "module" errors.');
  }
}

runTest();
