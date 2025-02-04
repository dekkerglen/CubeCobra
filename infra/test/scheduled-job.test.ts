import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

import { ScheduledJob } from '../lib/scheduled-job';
import { BaseTestStack } from './base-test-stack';

// Mock ECS Cluster
const mockCluster: ecs.ICluster = {
  clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/TestCluster',
  stack: { partition: 'aws', region: 'us-east-1' } as cdk.Stack,
  env: { region: 'us-east-1' },
  vpc: {
    vpcId: 'vpc-id',
    selectSubnets: jest.fn().mockReturnValue({
      subnetIds: ['subnet-12345678', 'subnet-87654321'],
    }),
  } as unknown as IVpc,
} as ecs.ICluster;

const mockRepository: ecr.IRepository = {
  repositoryArn: 'arn:aws:ecr:us-east-1:123456789012:repository/TestRepository',
  repositoryName: 'TestRepository',
  repositoryUriForTagOrDigest: (tagOrDigest?: string) =>
    `123456789012.dkr.ecr.us-east-1.amazonaws.com/TestRepository:${tagOrDigest ?? 'latest'}`,
  grantPull: jest.fn(),
} as unknown as ecr.IRepository;

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ScheduledJob(this, 'TestScheduledJob', mockCluster, mockRepository, {
      command: ['echo', 'Hello World'],
      memoryLimitMib: 512,
      cpu: 256,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      tag: 'latest',
    });
  }
}

test('Creates a Fargate Task Definition', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    Cpu: '256',
    Memory: '512',
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Image: Match.stringLikeRegexp('TestRepository:latest'),
        Command: ['echo', 'Hello World'],
        LogConfiguration: {
          LogDriver: 'awslogs',
          Options: Match.objectLike({
            'awslogs-stream-prefix': 'TestScheduledJob',
          }),
        },
      }),
    ]),
  });
});

test('Creates a CloudWatch Events Rule with schedule', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Events::Rule', {
    ScheduleExpression: 'rate(5 minutes)',
  });
});

test('CloudWatch Events Rule targets ECS task', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Events::Rule', {
    Targets: Match.arrayWith([
      Match.objectLike({
        Arn: 'arn:aws:ecs:us-east-1:123456789012:cluster/TestCluster',
        RoleArn: Match.anyValue(),
      }),
    ]),
  });
});
