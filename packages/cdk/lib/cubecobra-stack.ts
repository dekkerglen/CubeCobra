import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { CfnInstanceProfile, ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { ParameterValueType } from 'aws-cdk-lib/aws-ssm';

import { CardUpdateMonitorLambda } from './card-update-monitor-lambda';
import { Certificates } from './certificates';
import { DailyJobsLambdaConstruct } from './daily-jobs-lambda';
import { DynamodbTables } from './dynamodb-tables';
import { ECR } from './ecr';
import { ElasticBeanstalk } from './elastic-beanstalk';
import { JobsEcsTask } from './jobs-ecs-task';
import { Route53 } from './route53';
import { S3Buckets } from './s3-buckets';
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
  jobsBucket: string;
  downTimeActive: boolean;
  dynamoPrefix: string;
  env: Environment;
  jobsToken: string;
  nitroPayEnabled: boolean;
  patreonClientId: string;
  patreonClientSecret: string;
  patreonHookSecret: string;
  patreonRedirect: string;
  sessionToken: string;
  sessionSecret: string;
  fleetSize: number;
  jobs?: Map<string, ScheduledJobProps>;
  captchaSiteKey: string;
  captchaSecretKey: string;
  draftmancerApiKey: string;
  stripeSecretKey: string;
  stripePublicKey: string;
  enableBotSecurity: boolean;
  maintainCubeCardHashes: boolean;
}

export type Environment = 'production' | 'development';

export class CubeCobraStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, params: CubeCobraStackParams, props?: cdk.StackProps) {
    super(scope, id, props);

    const cert = new Certificates(this, 'Certificates', { domain: params.domain });

    const role = new Role(this, 'InstanceRole', { assumedBy: new ServicePrincipal('ec2.amazonaws.com') });
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'));

    const instanceProfile = new CfnInstanceProfile(this, 'InstanceProfile', { roles: [role.roleName] });

    // Create S3 buckets construct to import existing data and app buckets, and create jobs bucket
    const s3Buckets = new S3Buckets(this, 'S3Buckets', {
      dataBucketName: params.dataBucket,
      appBucketName: params.appBucket,
      jobsBucketName: params.jobsBucket,
    });

    // Grant the instance role read/write access to the data bucket
    // Since we're importing the bucket, we need to explicitly add IAM permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        resources: [`arn:aws:s3:::${params.dataBucket}`, `arn:aws:s3:::${params.dataBucket}/*`],
      }),
    );

    // Grant the instance role read/write access to the jobs bucket
    s3Buckets.jobsBucket.grantReadWrite(role);

    // Create DynamoDB single table
    const dynamoTables = new DynamodbTables(this, 'DynamoDBTables', { prefix: params.dynamoPrefix });

    // Grant the instance role read/write access to the table
    dynamoTables.table.grantReadWriteData(role);

    // Grant the instance role permissions to create and access the sessions table
    // The sessions table is auto-created by the application with the same prefix
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:CreateTable',
          'dynamodb:DescribeTable',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          `arn:aws:dynamodb:${props?.env?.region}:${props?.env?.account}:table/${params.dynamoPrefix}_SESSIONS`,
        ],
      }),
    );

    // Grant the instance role permissions to send emails via SES
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [`arn:aws:ses:${props?.env?.region}:${props?.env?.account}:identity/*`],
      }),
    );

    // Grant the instance role permissions to write logs to CloudWatch
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams'],
        resources: [`arn:aws:logs:${props?.env?.region}:${props?.env?.account}:log-group:*`],
      }),
    );

    // Create everything we need related to ElasticBeanstalk, including the environment and the application
    const elasticBeanstalk = new ElasticBeanstalk(this, 'ElasticBeanstalk', {
      certificate: cert.consoleCertificate,
      environmentName: params.environmentName,
      environmentVariables: createEnvironmentVariables(params, props, dynamoTables.table.tableName),
      fleetSize: params.fleetSize,
      instanceProfile: instanceProfile,
      appBucket: s3Buckets.appBucket,
      appVersion: params.version,
    });

    new Route53(this, 'Route53', {
      dnsName: elasticBeanstalk.environment.attrEndpointUrl,
      domain: params.domain,
    });

    // Create the ECS cluster where we'll schedule jobs
    // Use default VPC for simplicity
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });
    const fargateCluster = new ecs.Cluster(this, 'SharedFargateCluster', { vpc });

    const roleArn = ssm.StringParameter.valueForTypedStringParameterV2(
      this,
      '/cdk/bootstrap/github-actions-role-arn',
      ParameterValueType.STRING,
    );

    const githubRole = iam.Role.fromRoleArn(this, 'ImportedGitHubActionsRole', roleArn, { mutable: true }) as iam.Role;
    const ecr = new ECR(this, 'Ecr', githubRole);

    // Create ECR repository for jobs container
    const jobsEcr = new ECR(this, 'JobsEcr', githubRole);

    // Create the jobs ECS task with environment variables
    const jobsEnvVars = createJobsEnvironmentVariables(params, props, dynamoTables.table.tableName);
    const jobsTask = new JobsEcsTask(this, 'JobsTask', {
      repository: jobsEcr.repository,
      cluster: fargateCluster,
      environmentVariables: jobsEnvVars,
    });

    // Register all the scheduled jobs we have
    params.jobs?.forEach((jobProps, jobName) => {
      new ScheduledJob(this, jobName, fargateCluster, ecr.repository, jobProps);
    });

    // Create the daily jobs lambda with environment variables
    // Lambda uses execution role for AWS credentials, not access keys
    const lambdaEnvVars = createLambdaEnvironmentVariables(params, props, dynamoTables.table.tableName);

    new DailyJobsLambdaConstruct(this, 'DailyJobsLambda', {
      codeArtifactsBucket: params.appBucket,
      version: params.version,
      subdomain: params.domain.split('.')[0],
      stage: params.env,
      environmentVariables: lambdaEnvVars,
    });

    // Create the card update monitor lambda (runs every 5 minutes)
    new CardUpdateMonitorLambda(this, 'CardUpdateMonitorLambda', {
      codeArtifactsBucket: params.appBucket,
      version: params.version,
      subdomain: params.domain.split('.')[0],
      stage: params.env,
      environmentVariables: lambdaEnvVars,
      cluster: fargateCluster,
      taskDefinitionArn: jobsTask.taskDefinition.taskDefinitionArn,
      taskRole: jobsTask.taskRole,
      executionRole: jobsTask.executionRole,
      vpc,
    });
  }
}

function createEnvironmentVariables(
  params: CubeCobraStackParams,
  props: StackProps | undefined,
  dynamoTableName?: string,
): {
  [key: string]: string;
} {
  const envVars: { [key: string]: string } = {
    AWS_ACCESS_KEY_ID: params.accessKey,
    AWS_SECRET_ACCESS_KEY: params.secretKey,
    AWS_LOG_GROUP: params.awsLogGroup,
    AWS_LOG_STREAM: params.awsLogStream,
    AWS_REGION: props?.env?.region || '',
    CLOUDWATCH_ENABLED: params.environmentName === 'local' ? 'false' : 'true',
    CUBECOBRA_VERSION: params.version,
    DATA_BUCKET: params.dataBucket,
    DOMAIN: params.domain,
    DOWNTIME_ACTIVE: params.downTimeActive ? 'true' : 'false',
    DYNAMO_PREFIX: params.dynamoPrefix,
    ENV: params.env,
    NODE_ENV: params.environmentName === 'local' ? 'development' : 'production',
    JOBS_TOKEN: params.jobsToken,
    NITROPAY_ENABLED: params.nitroPayEnabled ? 'true' : 'false',
    PATREON_CLIENT_ID: params.patreonClientId,
    PATREON_CLIENT_SECRET: params.patreonClientSecret,
    PATREON_HOOK_SECRET: params.patreonHookSecret,
    PATREON_REDIRECT: params.patreonRedirect,
    PORT: '8080',
    SESSION: params.sessionToken,
    SESSION_SECRET: params.sessionSecret,
    USE_S3: 'true',
    CAPTCHA_SITE_KEY: params.captchaSiteKey,
    CAPTCHA_SECRET_KEY: params.captchaSecretKey,
    DRAFTMANCER_API_KEY: params.draftmancerApiKey,
    STRIPE_SECRET_KEY: params.stripeSecretKey,
    STRIPE_PUBLIC_KEY: params.stripePublicKey,
    ENABLE_BOT_SECURITY: params.enableBotSecurity ? 'true' : 'false',
    MAINTAIN_CUBE_CARD_HASHES: params.maintainCubeCardHashes ? 'true' : 'false',
  };

  // Add DYNAMO_TABLE if it's provided
  if (dynamoTableName) {
    envVars.DYNAMO_TABLE = dynamoTableName;
  }

  return envVars;
}

function createLambdaEnvironmentVariables(
  params: CubeCobraStackParams,
  props: StackProps | undefined,
  dynamoTableName?: string,
): {
  [key: string]: string;
} {
  const envVars: { [key: string]: string } = {
    CLOUDWATCH_ENABLED: 'false',
    CUBECOBRA_VERSION: params.version,
    DATA_BUCKET: params.dataBucket,
    DOMAIN: params.domain,
    DYNAMO_PREFIX: params.dynamoPrefix,
    ENV: params.env,
    NODE_ENV: params.environmentName === 'local' ? 'development' : 'production',
    USE_S3: 'true',
    DRAFTMANCER_API_KEY: params.draftmancerApiKey,
    ENABLE_BOT_SECURITY: params.enableBotSecurity ? 'true' : 'false',
    MAINTAIN_CUBE_CARD_HASHES: params.maintainCubeCardHashes ? 'true' : 'false',
  };

  // Add DYNAMO_TABLE if it's provided
  if (dynamoTableName) {
    envVars.DYNAMO_TABLE = dynamoTableName;
  }

  return envVars;
}

function createJobsEnvironmentVariables(
  params: CubeCobraStackParams,
  props: StackProps | undefined,
  dynamoTableName?: string,
): {
  [key: string]: string;
} {
  const envVars: { [key: string]: string } = {
    AWS_REGION: props?.env?.region || '',
    CLOUDWATCH_ENABLED: 'false',
    DATA_BUCKET: params.dataBucket,
    JOBS_BUCKET: params.jobsBucket,
    DYNAMO_DB_PREFIX: params.dynamoPrefix,
    NODE_ENV: params.environmentName === 'local' ? 'development' : 'production',
  };

  // Add DYNAMO_TABLE if it's provided
  if (dynamoTableName) {
    envVars.DYNAMO_TABLE = dynamoTableName;
  }

  return envVars;
}
