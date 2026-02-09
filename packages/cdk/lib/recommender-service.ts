import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CfnApplication, CfnApplicationVersion, CfnEnvironment } from 'aws-cdk-lib/aws-elasticbeanstalk';
import { CfnInstanceProfile } from 'aws-cdk-lib/aws-iam';
import { LogGroup, LogStream, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface RecommenderServiceProps {
  appBucket: IBucket;
  appVersion: string;
  environmentName: string;
  vpc: ec2.IVpc;
  fleetSize: number;
  instanceProfile: CfnInstanceProfile;
  environmentVariables: { [key: string]: string };
}

export class RecommenderService extends Construct {
  public readonly application: CfnApplication;
  public readonly appVersion: CfnApplicationVersion;
  public readonly environment: CfnEnvironment;
  public readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: RecommenderServiceProps) {
    super(scope, id);

    // Create CloudWatch log group with new CDK-managed naming schema
    // Format: /cubecobra/{env}/recommender/application
    const logGroupName = `/cubecobra/${props.environmentName}/recommender/application`;
    this.logGroup = new LogGroup(this, 'RecommenderLogGroup', {
      logGroupName,
      retention: RetentionDays.ONE_MONTH,
    });

    // Create the default log stream
    new LogStream(this, 'RecommenderLogStream', {
      logGroup: this.logGroup,
      logStreamName: 'default',
    });

    this.application = new CfnApplication(scope, 'RecommenderApplication', {
      applicationName: `CubeCobra-Recommender-${props.environmentName}-app`,
    });

    this.application.addDependency(props.instanceProfile);

    this.appVersion = new CfnApplicationVersion(scope, 'RecommenderAppVersion', {
      applicationName: this.application.ref,
      description: props.appVersion,
      sourceBundle: {
        s3Bucket: props.appBucket.bucketName,
        s3Key: `builds/recommender-${props.appVersion}.zip`,
      },
    });

    this.appVersion.addDependency(this.application);

    this.environment = new CfnEnvironment(scope, 'RecommenderEnvironmentV2', {
      environmentName: `cubecobra-recommender-${props.environmentName}-v2-env`,
      applicationName: this.application.ref,
      solutionStackName: '64bit Amazon Linux 2023 v6.4.0 running Node.js 20',
      optionSettings: [
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'InstanceType',
          value: 't3.medium', // Medium instance for ML service (without carddict)
        },
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'IamInstanceProfile',
          value: props.instanceProfile.ref,
        },
        {
          namespace: 'aws:autoscaling:asg',
          optionName: 'MinSize',
          value: `${props.fleetSize}`,
        },
        {
          namespace: 'aws:autoscaling:asg',
          optionName: 'MaxSize',
          value: `${props.fleetSize + 1}`,
        },
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'EnvironmentType',
          value: 'LoadBalanced',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'LoadBalancerType',
          value: 'application',
        },
        // VPC configuration - required for internal ALB
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'VPCId',
          value: props.vpc.vpcId,
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'Subnets',
          value: props.vpc.publicSubnets.map((s) => s.subnetId).join(','),
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'ELBSubnets',
          value: props.vpc.publicSubnets.map((s) => s.subnetId).join(','),
        },
        // Internal ALB - only accessible within VPC
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'ELBScheme',
          value: 'internal',
        },
        // HTTP listener for internal traffic (no SSL overhead needed)
        {
          namespace: 'aws:elbv2:listener:80',
          optionName: 'ListenerEnabled',
          value: 'true',
        },
        {
          namespace: 'aws:elbv2:listener:80',
          optionName: 'Protocol',
          value: 'HTTP',
        },
        // Disable HTTPS listener (not needed for internal traffic)
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'ListenerEnabled',
          value: 'false',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'HealthCheckPath',
          value: '/healthcheck',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'HealthCheckInterval',
          value: '30',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'HealthCheckTimeout',
          value: '5',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'HealthyThresholdCount',
          value: '2',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'UnhealthyThresholdCount',
          value: '10',
        },
        {
          namespace: 'aws:elasticbeanstalk:command',
          optionName: 'DeploymentPolicy',
          value: 'Rolling',
        },
        {
          namespace: 'aws:elasticbeanstalk:command',
          optionName: 'BatchSize',
          value: '50',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'StickinessEnabled',
          value: 'true',
        },
        ...Object.keys(props.environmentVariables).map((key) => ({
          namespace: 'aws:elasticbeanstalk:application:environment',
          optionName: key,
          value: props.environmentVariables[key],
        })),
      ],
      versionLabel: this.appVersion.ref,
    });

    this.environment.addDependency(this.appVersion);
  }
}
