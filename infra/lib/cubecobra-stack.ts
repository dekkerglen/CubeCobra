import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { CfnInstanceProfile, ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import { Certificates } from './certificates';
import { ECR } from './ecr';
import { ElasticBeanstalk } from './elastic-beanstalk';
import { Pipeline } from './pipeline';
import { Route53 } from './route53';
import { ScheduledJob, ScheduledJobProps } from './scheduled-job';

interface CubeCobraStackParams {
  accessKey: string;
  secretKey: string;
  domain: string;
  version: string;
  environmentName: string;
  awsLogGroup: string;
  awsLogStream: string;
  dataBucket: string;
  appBucket: string;
  downTimeActive: boolean;
  dynamoPrefix: string;
  emailUser: string;
  emailPass: string;
  env: Environment;
  jobsToken: string;
  nitroPayEnabled: boolean;
  patreonClientId: string;
  patreonClientSecret: string;
  patreonHookSecret: string;
  patreonRedirect: string;
  sessionToken: string;
  sessionSecret: string;
  tcgPlayerPublicKey: string;
  tcgPlayerPrivateKey: string;
  fleetSize: number;
  jobs?: Map<string, ScheduledJobProps>;
  captchaSiteKey: string;
  captchaSecretKey: string;
  draftmancerApiKey: string;
  stripeSecretKey: string;
  stripePublicKey: string;
}

export type Environment = 'production' | 'development';

export class CubeCobraStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, params: CubeCobraStackParams, props?: cdk.StackProps) {
    super(scope, id, props);

    const cert = new Certificates(this, 'Certificates', { domain: params.domain });

    const role = new Role(this, 'InstanceRole', { assumedBy: new ServicePrincipal('ec2.amazonaws.com') });
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'));

    const instanceProfile = new CfnInstanceProfile(this, 'InstanceProfile', { roles: [role.roleName] });

    const appBucket = Bucket.fromBucketName(this, 'AppBucket', params.appBucket);

    // Create everything we need related to ElasticBeanstalk, including the environment and the application
    const elasticBeanstalk = new ElasticBeanstalk(this, 'ElasticBeanstalk', {
      certificate: cert.consoleCertificate,
      environmentName: params.environmentName,
      environmentVariables: createEnvironmentVariables(params, props),
      fleetSize: params.fleetSize,
      instanceProfile: instanceProfile,
      appBucket: appBucket,
      appVersion: params.version,
    });

    new Route53(this, 'Route53', {
      dnsName: elasticBeanstalk.environment.attrEndpointUrl,
      domain: params.domain,
    });

    // TODO: Not sure if we want this. Creating the tables with the app is beneficial (especially for local dev)
    // new DynamodbTables(this, "DynamoDBTables", {prefix: params.dynamoPrefix})

    // Create the ECS cluster where we'll schedule jobs
    const fargateCluster = new ecs.Cluster(this, 'SharedFargateCluster');

    // Build everything we need to run our deployment pipelines on GitHub
    const pipeline = new Pipeline(this, 'Pipeline', {
      githubRepositories: ['dekkerglen/CubeCobra'],
    });

    // Create an ECR repository and grant the proper access to our pipeline role
    const ecr = new ECR(this, 'Ecr', pipeline.githubRole);

    // Register all the scheduled jobs we have
    params.jobs?.forEach((jobProps, jobName) => {
      new ScheduledJob(this, jobName, fargateCluster, ecr.repository, jobProps);
    });
  }
}

function createEnvironmentVariables(
  params: CubeCobraStackParams,
  props: StackProps | undefined,
): {
  [key: string]: string;
} {
  return {
    AWS_ACCESS_KEY_ID: params.accessKey,
    AWS_SECRET_ACCESS_KEY: params.secretKey,
    AWS_LOG_GROUP: params.awsLogGroup,
    AWS_LOG_STREAM: params.awsLogStream,
    AWS_REGION: props?.env?.region || '',
    CACHE_ENABLED: 'false',
    CUBECOBRA_VERSION: params.version,
    DATA_BUCKET: params.dataBucket,
    DOMAIN: params.domain,
    DOWNTIME_ACTIVE: params.downTimeActive ? 'true' : 'false',
    DYNAMO_PREFIX: params.dynamoPrefix,
    EMAIL_CONFIG_PASSWORD: params.emailPass,
    EMAIL_CONFIG_USERNAME: params.emailUser,
    ENV: params.env,
    NODE_ENV: params.env,
    JOBS_TOKEN: params.jobsToken,
    NITROPAY_ENABLED: params.nitroPayEnabled ? 'true' : 'false',
    PATREON_CLIENT_ID: params.patreonClientId,
    PATREON_CLIENT_SECRET: params.patreonClientSecret,
    PATREON_HOOK_SECRET: params.patreonHookSecret,
    PATREON_REDIRECT: params.patreonRedirect,
    PORT: '8080',
    SESSION: params.sessionToken,
    SESSION_SECRET: params.sessionSecret,
    TCG_PLAYER_PRIVATE_KEY: params.tcgPlayerPrivateKey,
    TCG_PLAYER_PUBLIC_KEY: params.tcgPlayerPublicKey,
    USE_S3: 'true',
    CAPTCHA_SITE_KEY: params.captchaSiteKey,
    CAPTCHA_SECRET_KEY: params.captchaSecretKey,
    DRAFTMANCER_API_KEY: params.draftmancerApiKey,
    STRIPE_SECRET_KEY: params.stripeSecretKey,
    STRIPE_PUBLIC_KEY: params.stripePublicKey,
  };
}
