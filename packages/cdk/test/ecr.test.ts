import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Construct } from 'constructs';

import { ECR } from '../lib/ecr';
import { BaseTestStack } from './base-test-stack';

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ECR(this, 'TestECR');
  }
}

test('ECR repository is created', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::ECR::Repository', 1);
});

test('ECR repository scans images on push', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ECR::Repository', {
    ImageScanningConfiguration: { ScanOnPush: true },
  });
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

test('No IAM grants are attached to external roles', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::IAM::Policy', 0);
});
