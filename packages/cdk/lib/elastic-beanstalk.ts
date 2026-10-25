import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CfnApplication, CfnApplicationVersion, CfnEnvironment } from 'aws-cdk-lib/aws-elasticbeanstalk';
import { CfnInstanceProfile } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface ElasticBeanstalkApplicationProps {
  appBucket: IBucket;
  appVersion: string;
  environmentName: string;
  certificate: Certificate;
  vpc: ec2.IVpc;
  fleetSize: number;
  instanceProfile: CfnInstanceProfile;
  environmentVariables: { [key: string]: string };
  /**
   * Opt-in (default false): replace the EB-managed load balancer security group (open to
   * 0.0.0.0/0) with one that only admits Cloudflare's published ranges on 80/443. See
   * restrictAlbToCloudflare in config.ts for the prerequisites.
   */
  restrictIngressToCloudflare?: boolean;
}

// Cloudflare's published edge ranges (https://www.cloudflare.com/ips-v4 and /ips-v6). Re-check
// them when enabling restrictIngressToCloudflare; Cloudflare announces changes in advance.
export const CLOUDFLARE_IPV4_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

export const CLOUDFLARE_IPV6_RANGES = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

export class ElasticBeanstalk extends Construct {
  public readonly application: CfnApplication;
  public readonly appVersion: CfnApplicationVersion;
  public readonly environment: CfnEnvironment;
  public readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: ElasticBeanstalkApplicationProps) {
    super(scope, id);

    // Create CloudWatch log groups with new CDK-managed naming schema
    // Format: /cubecobra/{env}/server/{level}
    const infoLogGroupName = `/cubecobra/${props.environmentName}/server/info`;
    const errorLogGroupName = `/cubecobra/${props.environmentName}/server/error`;

    // Create INFO log group
    const infoLogGroup = new LogGroup(this, 'ServerInfoLogGroup', {
      logGroupName: infoLogGroupName,
      retention: RetentionDays.ONE_MONTH,
    });

    // Create ERROR log group
    new LogGroup(this, 'ServerErrorLogGroup', {
      logGroupName: errorLogGroupName,
      retention: RetentionDays.ONE_MONTH,
    });

    // Create CLIENT ERROR log group — browser-reported errors collected via the
    // /api/clienterror endpoint. Format: /cubecobra/{env}/client/error
    new LogGroup(this, 'ClientErrorLogGroup', {
      logGroupName: `/cubecobra/${props.environmentName}/client/error`,
      retention: RetentionDays.ONE_MONTH,
    });

    this.logGroup = infoLogGroup; // For compatibility

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

    // Optional Cloudflare-only load balancer security group. EB attaches it to the ALB in place of
    // the security group it would otherwise create (ManagedSecurityGroup + SecurityGroups), and adds
    // the instance-side rule allowing traffic from it, so instances stay reachable only via the ALB.
    const loadBalancerSecurityGroupSettings: CfnEnvironment.OptionSettingProperty[] = [];
    if (props.restrictIngressToCloudflare) {
      const albSecurityGroup = new ec2.SecurityGroup(this, 'CloudflareOnlyAlbSecurityGroup', {
        vpc: props.vpc,
        description: `CubeCobra ${props.environmentName} ALB: HTTP/HTTPS from Cloudflare only`,
        // The ALB must reach the instances (and run health checks) on the instance port.
        allowAllOutbound: true,
      });
      for (const cidr of CLOUDFLARE_IPV4_RANGES) {
        albSecurityGroup.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(443), 'Cloudflare HTTPS');
        albSecurityGroup.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(80), 'Cloudflare HTTP');
      }
      for (const cidr of CLOUDFLARE_IPV6_RANGES) {
        albSecurityGroup.addIngressRule(ec2.Peer.ipv6(cidr), ec2.Port.tcp(443), 'Cloudflare HTTPS');
        albSecurityGroup.addIngressRule(ec2.Peer.ipv6(cidr), ec2.Port.tcp(80), 'Cloudflare HTTP');
      }
      loadBalancerSecurityGroupSettings.push(
        {
          namespace: 'aws:elbv2:loadbalancer',
          optionName: 'SecurityGroups',
          value: albSecurityGroup.securityGroupId,
        },
        {
          namespace: 'aws:elbv2:loadbalancer',
          optionName: 'ManagedSecurityGroup',
          value: albSecurityGroup.securityGroupId,
        },
      );
    }

    this.environment = new CfnEnvironment(scope, 'EnvironmentV2', {
      environmentName: `cubecobra-${props.environmentName}-v2-env`,
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
        // IMDSv2 is required (DisableIMDSv1 = true) by default on Amazon Linux 2023 platforms, and
        // every environment runs that way. It isn't pinned here because it is an instance-replacing
        // setting; see "Elastic Beanstalk settings and immutable deploys" in the README.
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
        // VPC configuration
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
        // The listener's TLS policy (SSLPolicy) is set on each environment outside this template; see
        // "Elastic Beanstalk settings and immutable deploys" in the README.
        ...loadBalancerSecurityGroupSettings,
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
        // Every pipeline deploy ships a new application version, and EB rejects an immutable deployment
        // that also changes an instance-replacing or load balancer setting, while CloudFormation still
        // reports success. Settings in those groups can't change through this template; see
        // "Elastic Beanstalk settings and immutable deploys" in the README.
        {
          namespace: 'aws:elasticbeanstalk:command',
          optionName: 'DeploymentPolicy',
          value: 'Immutable',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'StickinessEnabled',
          value: 'true',
        },
        // Enhanced health reporting (required for managed actions)
        {
          namespace: 'aws:elasticbeanstalk:healthreporting:system',
          optionName: 'SystemType',
          value: 'enhanced',
        },
        // Managed actions - periodic instance refresh to mitigate memory leak
        {
          namespace: 'aws:elasticbeanstalk:managedactions',
          optionName: 'ManagedActionsEnabled',
          value: 'true',
        },
        {
          namespace: 'aws:elasticbeanstalk:managedactions',
          optionName: 'PreferredStartTime',
          value: 'Sun:06:00',
        },
        {
          namespace: 'aws:elasticbeanstalk:managedactions',
          optionName: 'ServiceRoleForManagedUpdates',
          value: 'AWSServiceRoleForElasticBeanstalkManagedUpdates',
        },
        {
          namespace: 'aws:elasticbeanstalk:managedactions:platformupdate',
          optionName: 'UpdateLevel',
          value: 'minor',
        },
        {
          namespace: 'aws:elasticbeanstalk:managedactions:platformupdate',
          optionName: 'InstanceRefreshEnabled',
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
