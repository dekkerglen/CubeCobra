import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Construct } from 'constructs';

import { Pipeline } from '../lib/pipeline';
import { BaseTestStack } from './base-test-stack';

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new Pipeline(this, 'TestPipeline', {
      githubRepositories: ['my-org/my-repo'],
    });
  }
}

test('Creates an OpenID Connect Provider for GitHub', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('Custom::AWSCDKOpenIdConnectProvider', {
    Url: 'https://token.actions.githubusercontent.com',
    ClientIDList: ['sts.amazonaws.com'],
  });
});

test('Creates an IAM Role for GitHub Actions', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [
        {
          Action: 'sts:AssumeRoleWithWebIdentity',
          Effect: 'Allow',
          Principal: {
            Federated: Match.anyValue(),
          },
          Condition: {
            'ForAnyValue:StringLike': {
              'token.actions.githubusercontent.com:sub': ['repo:my-org/my-repo:*'],
            },
          },
        },
      ],
    },
  });
});

test('Outputs IAM Role ARN', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  // Check if there's an output for the GitHub Actions role ARN
  template.hasOutput('*', {
    Description: 'The ARN of the IAM role for GitHub Actions',
  });
});
