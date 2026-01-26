import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CfnApplication, CfnApplicationVersion, CfnEnvironment } from 'aws-cdk-lib/aws-elasticbeanstalk';
import { CfnInstanceProfile } from 'aws-cdk-lib/aws-iam';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface ElasticBeanstalkApplicationProps {
  appBucket: IBucket;
  appVersion: string;
  environmentName: string;
  certificate: Certificate;
  fleetSize: number;
  instanceProfile: CfnInstanceProfile;
  environmentVariables: { [key: string]: string };
}

export class ElasticBeanstalk extends Construct {
  public readonly application: CfnApplication;
  public readonly appVersion: CfnApplicationVersion;
  public readonly environment: CfnEnvironment;

  constructor(scope: Construct, id: string, props: ElasticBeanstalkApplicationProps) {
    super(scope, id);

    this.application = new CfnApplication(scope, 'Application', {
      applicationName: `CubeCobra-${props.environmentName}-app`,
    });

    this.application.addDependency(props.instanceProfile);

    this.appVersion = new CfnApplicationVersion(scope, 'AppVersion', {
      applicationName: this.application.ref,
      description: props.appVersion,
      sourceBundle: {
        s3Bucket: props.appBucket.bucketName,
        s3Key: `builds/${props.appVersion}.zip`,
      },
    });

    this.appVersion.addDependency(this.application);

    this.environment = new CfnEnvironment(scope, 'Environment', {
      environmentName: `cubecobra-${props.environmentName}-env`,
      applicationName: this.application.ref,
      solutionStackName: '64bit Amazon Linux 2023 v6.4.0 running Node.js 20',
      optionSettings: [
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'InstanceType',
          value: 't3.large',
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
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'ListenerEnabled',
          value: 'true',
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'SSLCertificateArns',
          value: props.certificate.certificateArn,
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'Protocol',
          value: 'HTTPS',
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
