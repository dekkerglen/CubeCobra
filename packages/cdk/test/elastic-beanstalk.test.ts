import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES, ElasticBeanstalk } from '../lib/elastic-beanstalk';
import { BaseTestStack } from './base-test-stack';

const mockBucket: s3.IBucket = {
  bucketName: 'mock-bucket',
} as s3.IBucket;

const mockCertificate: acm.Certificate = {
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/mock-cert',
} as unknown as acm.Certificate;

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string, restrictIngressToCloudflare?: boolean) {
    super(scope, id);

    const instanceProfile = new iam.CfnInstanceProfile(this, 'MockInstanceProfile', {
      roles: ['mock-role'],
    });

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'MockVpc', {
      vpcId: 'vpc-12345678',
      availabilityZones: ['us-east-1a', 'us-east-1b'],
      publicSubnetIds: ['subnet-11111111', 'subnet-22222222'],
    });

    new ElasticBeanstalk(this, 'TestElasticBeanstalk', {
      appBucket: mockBucket,
      appVersion: 'v1.0.0',
      environmentName: 'test',
      certificate: mockCertificate,
      vpc,
      fleetSize: 2,
      instanceProfile: instanceProfile,
      environmentVariables: {
        NODE_ENV: 'production',
        SOME_ENV_VAR: 'MyValue',
      },
      restrictIngressToCloudflare,
    });
  }
}

const buildTemplate = (restrictIngressToCloudflare?: boolean): Template => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack', restrictIngressToCloudflare);
  return Template.fromStack(stack);
};

const optionSettings = (template: Template): any[] =>
  (Object.values(template.findResources('AWS::ElasticBeanstalk::Environment'))[0] as any).Properties.OptionSettings;

test('Creates an Elastic Beanstalk Application', () => {
  const template = buildTemplate();

  template.hasResourceProperties('AWS::ElasticBeanstalk::Application', {
    ApplicationName: 'CubeCobra-test-app',
  });
});

test('Creates an Application Version with the correct S3 source', () => {
  const template = buildTemplate();

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
  const template = buildTemplate();

  template.hasResourceProperties('AWS::ElasticBeanstalk::Environment', {
    EnvironmentName: 'cubecobra-test-v2-env',
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

test('Load balancer keeps the EB-managed security group by default', () => {
  const template = buildTemplate();

  template.resourceCountIs('AWS::EC2::SecurityGroup', 0);
  expect(optionSettings(template).filter((o) => o.Namespace === 'aws:elbv2:loadbalancer')).toEqual([]);
});

test('Opt-in Cloudflare restriction puts a Cloudflare-only security group on the load balancer', () => {
  const template = buildTemplate(true);

  template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
  const securityGroup: any = Object.values(template.findResources('AWS::EC2::SecurityGroup'))[0];
  const ingress: any[] = securityGroup.Properties.SecurityGroupIngress;

  // Exactly ports 80 and 443 for every published range, and nothing else (in particular no 0.0.0.0/0).
  const expected = [
    ...CLOUDFLARE_IPV4_RANGES.flatMap((cidr) => [`${cidr}|443`, `${cidr}|80`]),
    ...CLOUDFLARE_IPV6_RANGES.flatMap((cidr) => [`${cidr}|443`, `${cidr}|80`]),
  ].sort();
  const actual = ingress
    .map((rule) => {
      expect(rule.IpProtocol).toBe('tcp');
      expect(rule.FromPort).toBe(rule.ToPort);
      return `${rule.CidrIp ?? rule.CidrIpv6}|${rule.FromPort}`;
    })
    .sort();
  expect(actual).toEqual(expected);

  const lbSettings = optionSettings(template).filter((o) => o.Namespace === 'aws:elbv2:loadbalancer');
  const sgRef = { 'Fn::GetAtt': [Match.stringLikeRegexp('CloudflareOnlyAlbSecurityGroup'), 'GroupId'] };
  expect(lbSettings).toHaveLength(2);
  template.hasResourceProperties('AWS::ElasticBeanstalk::Environment', {
    OptionSettings: Match.arrayWith([
      { Namespace: 'aws:elbv2:loadbalancer', OptionName: 'SecurityGroups', Value: sgRef },
      { Namespace: 'aws:elbv2:loadbalancer', OptionName: 'ManagedSecurityGroup', Value: sgRef },
    ]),
  });
});
