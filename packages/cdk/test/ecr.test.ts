import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { ECR } from '../lib/ecr';
import { BaseTestStack } from './base-test-stack';

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const pipelineRole = new iam.Role(this, 'PipelineRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });

    new ECR(this, 'TestECR', pipelineRole);
  }
}

test('ECR repository is created', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::ECR::Repository', 1);
});

test('CloudFormation outputs are created', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  const outputs = template.findOutputs('*');

  // We have to do this because CloudFormation outputs have random suffixes
  expect(Object.keys(outputs).some((key) => key.includes('RepositoryName'))).toBeTruthy();
  expect(Object.keys(outputs).some((key) => key.includes('RepositoryUri'))).toBeTruthy();
});

test('IAM Role has ECR push permissions', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Effect: 'Allow',
          Action: [
            'ecr:GetAuthorizationToken',
            'ecr:BatchCheckLayerAvailability',
            'ecr:InitiateLayerUpload',
            'ecr:UploadLayerPart',
            'ecr:CompleteLayerUpload',
            'ecr:PutImage',
          ],
        }),
      ]),
    },
  });
});

test('IAM Role has CloudFormation permissions', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'cloudformation:DescribeStacks',
          Effect: 'Allow',
          Resource: { Ref: 'AWS::StackId' },
        }),
      ]),
    },
  });
});
