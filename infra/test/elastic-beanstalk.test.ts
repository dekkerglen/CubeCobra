import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { ElasticBeanstalk } from '../lib/elastic-beanstalk';
import { BaseTestStack } from './base-test-stack';

const mockBucket: s3.IBucket = {
  bucketName: 'mock-bucket',
} as s3.IBucket;

const mockCertificate: acm.Certificate = {
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/mock-cert',
} as unknown as acm.Certificate;

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const instanceProfile = new iam.CfnInstanceProfile(this, 'MockInstanceProfile', {
      roles: ['mock-role'],
    });

    new ElasticBeanstalk(this, 'TestElasticBeanstalk', {
      appBucket: mockBucket,
      appVersion: 'v1.0.0',
      environmentName: 'test',
      certificate: mockCertificate,
      fleetSize: 2,
      instanceProfile: instanceProfile,
      environmentVariables: {
        NODE_ENV: 'production',
        SOME_ENV_VAR: 'MyValue',
      },
    });
  }
}

test('Creates an Elastic Beanstalk Application', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ElasticBeanstalk::Application', {
    ApplicationName: 'CubeCobra-test-app',
  });
});

test('Creates an Application Version with the correct S3 source', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ElasticBeanstalk::ApplicationVersion', {
    ApplicationName: { Ref: Match.anyValue() }, // Matches dynamically generated references
    Description: 'v1.0.0',
    SourceBundle: {
      S3Bucket: 'mock-bucket',
      S3Key: 'builds/v1.0.0.zip',
    },
  });
});

test('Creates an Elastic Beanstalk Environment with correct settings', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ElasticBeanstalk::Environment', {
    EnvironmentName: 'cubecobra-test-env',
    ApplicationName: { Ref: Match.anyValue() },
    SolutionStackName: '64bit Amazon Linux 2023 v6.4.0 running Node.js 20',
    OptionSettings: Match.arrayWith([
      { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'InstanceType', Value: 't3.large' },
      { Namespace: 'aws:autoscaling:launchconfiguration', OptionName: 'IamInstanceProfile', Value: Match.anyValue() },
      { Namespace: 'aws:autoscaling:asg', OptionName: 'MinSize', Value: '2' },
      { Namespace: 'aws:autoscaling:asg', OptionName: 'MaxSize', Value: '3' },
      { Namespace: 'aws:elasticbeanstalk:environment', OptionName: 'EnvironmentType', Value: 'LoadBalanced' },
      {
        Namespace: 'aws:elbv2:listener:443',
        OptionName: 'SSLCertificateArns',
        Value: 'arn:aws:acm:us-east-1:123456789012:certificate/mock-cert',
      },
      { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'NODE_ENV', Value: 'production' },
      {
        Namespace: 'aws:elasticbeanstalk:application:environment',
        OptionName: 'SOME_ENV_VAR',
        Value: 'MyValue',
      },
    ]),
  });
});
