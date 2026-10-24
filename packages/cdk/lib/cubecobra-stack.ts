import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { CfnInstanceProfile, ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as iam from 'aws-cdk-lib/aws-iam';

import { BotDeckbuildLambda } from './bot-deckbuild-lambda';
import { CardUpdateMonitorLambda } from './card-update-monitor-lambda';
import { Certificates } from './certificates';
import { DailyJobsLambdaConstruct } from './daily-jobs-lambda';
import { DynamodbTables } from './dynamodb-tables';
import { ECR } from './ecr';
import { ElasticBeanstalk } from './elastic-beanstalk';
import { JobsEcsTask } from './jobs-ecs-task';
import { RecommenderService } from './recommender-service';
import { Route53 } from './route53';
import { S3Buckets } from './s3-buckets';
import { ScheduledJob, ScheduledJobProps } from './scheduled-job';
import {
  BOT_DECKBUILD_SECRET_NAMES,
  DAILY_JOBS_SECRET_NAMES,
  R2_SECRET_NAMES,
  RECOMMENDER_SECRET_NAMES,
  ssmSecretsEnvironment,
  ssmSecretsPrefixFor,
  WEB_SERVER_SECRET_NAMES,
} from './secrets';

interface CubeCobraStackParams {
  domain: string;
  version: string;
  environmentName: string;
  awsLogGroup: string;
  awsLogStream: string;
  dataBucket: string;
  appBucket: string;
  downTimeActive: boolean;
  dynamoPrefix: string;
  env: Environment;
  nitroPayEnabled: boolean;
  patreonClientId: string;
  patreonClientSecret: string;
  patreonHookSecret: string;
  patreonRedirect: string;
  sessionToken: string;
  fleetSize: number;
  jobs?: Map<string, ScheduledJobProps>;
  captchaSiteKey: string;
  captchaSecretKey: string;
  gaMeasurementId: string;
  gaApiSecret: string;
  draftmancerApiKey: string;
  manaMatrixApiKey: string;
  stripeSecretKey: string;
  stripePublicKey: string;
  enableBotSecurity: boolean;
  /** Sends Clear-Site-Data: "cache" to evict poisoned browser caches. Temporary; see index.ts. */
  clearSiteCache: boolean;
  maintainCubeCardHashes: boolean;
  // Cloudflare R2 (S3-compatible) for self-hosted card images + static assets.
  // Empty on stages not yet cut over to R2.
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  cardImageBaseUrl: string;
  // Whether this environment owns the shared default VPC's gateway endpoints (see config.ts).
  manageSharedVpcEndpoints: boolean;
  // Shared secret for server/lambda -> recommender requests; empty disables recommender auth.
  recommenderSharedSecret: string;
  // Opt-in: restrict the web ALB's ingress to Cloudflare's IP ranges (see config.ts).
  restrictAlbToCloudflare: boolean;
  // Load secrets at runtime from SSM instead of synthesizing them (see config.ts, lib/secrets.ts).
  // When true the secret params above are ignored.
  secretsFromSsm: boolean;
}

export type Environment = 'production' | 'development';

export class CubeCobraStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, params: CubeCobraStackParams, props?: cdk.StackProps) {
    super(scope, id, props);

    const cert = new Certificates(this, 'Certificates', { domain: params.domain });

    const role = new Role(this, 'InstanceRole', { assumedBy: new ServicePrincipal('ec2.amazonaws.com') });
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'));

    const instanceProfile = new CfnInstanceProfile(this, 'InstanceProfile', { roles: [role.roleName] });

    // Create S3 buckets construct to import existing data and app buckets
    const s3Buckets = new S3Buckets(this, 'S3Buckets', {
      dataBucketName: params.dataBucket,
      appBucketName: params.appBucket,
    });

    // Grant the instance role read/write access to the data bucket
    // Since we're importing the bucket, we need to explicitly add IAM permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:GetObjectVersion',
          's3:PutObject',
          's3:DeleteObject',
          's3:ListBucket',
          's3:ListBucketVersions',
        ],
        resources: [`arn:aws:s3:::${params.dataBucket}`, `arn:aws:s3:::${params.dataBucket}/*`],
      }),
    );

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

    // Grant the instance role permissions to write logs to CloudWatch, and to fetch/stop
    // CloudWatch Logs Insights queries (used by the admin Errors/Performance dashboards).
    // The role is shared by the web server and the recommender, which write to several
    // /cubecobra/<env>/... groups.
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams',
          'logs:GetQueryResults',
          'logs:StopQuery',
        ],
        resources: [`arn:aws:logs:${props?.env?.region}:${props?.env?.account}:log-group:*`],
      }),
    );

    // StartQuery is what reads log data, and it is authorized per log group, so limit it to the
    // groups the admin dashboards query (serverutils/cloudwatchInsights.ts logGroupFor():
    // `${AWS_LOG_GROUP}/info`, `${AWS_LOG_GROUP}/error` and AWS_CLIENT_ERROR_LOG_GROUP, all set in
    // createEnvironmentVariables below). Both ARN forms are listed because the log-group ARN is
    // reported both with and without the trailing `:*`.
    const insightsLogGroups = [
      `/cubecobra/${params.environmentName}/server/info`,
      `/cubecobra/${params.environmentName}/server/error`,
      `/cubecobra/${params.environmentName}/client/error`,
    ];
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:StartQuery'],
        resources: insightsLogGroups.flatMap((name) => [
          `arn:aws:logs:${props?.env?.region}:${props?.env?.account}:log-group:${name}`,
          `arn:aws:logs:${props?.env?.region}:${props?.env?.account}:log-group:${name}:*`,
        ]),
      }),
    );

    // CloudWatch metrics (SQS queue depth + Lambda success rate) for the admin deckbuild
    // dashboard. GetMetricData does not support resource-level permissions.
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:GetMetricData'],
        resources: ['*'],
      }),
    );

    // Runtime secrets (config.ts secretsFromSsm): the web server and the recommender share this
    // role and load their secrets from /cubecobra/<segment>/secrets/ at startup. No kms:Decrypt:
    // the SecureStrings use the AWS-managed aws/ssm key, whose key policy allows decryption through
    // SSM; a customer-managed key would also need kms:Decrypt on that key.
    const secretsPrefix = params.secretsFromSsm ? ssmSecretsPrefixFor(params.environmentName) : undefined;
    if (secretsPrefix) {
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameters'],
          resources: [`arn:aws:ssm:${props?.env?.region}:${props?.env?.account}:parameter${secretsPrefix}*`],
        }),
      );
    }

    // Look up the default VPC - used by all services for internal communication
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // Create recommender service first (internal ALB, not publicly accessible)
    // We need its endpoint URL for the main server's ML_SERVICE_URL
    const recommenderFleetSize = params.environmentName === 'production' ? 3 : 1;
    const recommenderService = new RecommenderService(this, 'RecommenderService', {
      vpc,
      environmentName: params.environmentName,
      environmentVariables: createRecommenderEnvironmentVariables(params, props),
      fleetSize: recommenderFleetSize,
      instanceProfile: instanceProfile,
      appBucket: s3Buckets.appBucket,
      appVersion: params.version,
    });

    // The ML service URL uses the internal ALB endpoint (HTTP, VPC-internal only)
    // This eliminates public internet data transfer costs
    const mlServiceUrl = `http://${recommenderService.environment.attrEndpointUrl}`;

    // Note: No Route53 record for recommender service - it uses internal ALB
    // accessible only within the VPC via the internal ALB DNS name

    // Async bot-deckbuild pipeline (SNS -> SQS -> in-VPC Lambda). Created before the server env
    // is assembled so we can hand the server the topic ARN to publish to. The server writes a
    // carddb-free deckbuild job to S3; this Lambda reads it, calls the recommender directly
    // (hence in-VPC), and writes the built bot decks back to S3/DynamoDB.
    const botDeckbuildLambda = new BotDeckbuildLambda(this, 'BotDeckbuildLambda', {
      codeArtifactsBucket: params.appBucket,
      version: params.version,
      subdomain: params.domain.split('.')[0],
      stage: params.env,
      environmentVariables: createLambdaEnvironmentVariables(params, props, dynamoTables.table.tableName),
      mlServiceUrl,
      // Either the synthesized value or, with secretsFromSsm, the names to load at runtime.
      recommenderSharedSecret: secretsPrefix ? undefined : params.recommenderSharedSecret,
      ssmSecrets: secretsPrefix ? { prefix: secretsPrefix, names: BOT_DECKBUILD_SECRET_NAMES } : undefined,
      vpc,
      manageSharedVpcEndpoints: params.manageSharedVpcEndpoints,
    });

    // Let the web server (EC2 instance role) publish draft ids to the bot-deckbuild topic.
    botDeckbuildLambda.topic.grantPublish(role);

    // Create the ECS cluster where we'll schedule jobs
    const fargateCluster = new ecs.Cluster(this, 'SharedFargateCluster', { vpc });

    // Images are pushed only by the deployment pipeline's CodeBuild projects. The GitHub Actions
    // OIDC role that used to get push access here was unused and has been removed (M-14).
    const ecr = new ECR(this, 'Ecr');

    // Create ECR repository for jobs container
    const jobsEcr = new ECR(this, 'JobsEcr');

    // Create the jobs ECS task with environment variables
    const jobsEnvVars = createJobsEnvironmentVariables(params, props, dynamoTables.table.tableName);
    const jobsTask = new JobsEcsTask(this, 'JobsTask', {
      repository: jobsEcr.repository,
      cluster: fargateCluster,
      environmentName: params.environmentName,
      environmentVariables: jobsEnvVars,
      // With secretsFromSsm the R2 keys are injected by ECS from SSM (task-definition secrets)
      // instead of being written into the task definition's environment.
      ssmSecrets: secretsPrefix && params.r2Endpoint ? { prefix: secretsPrefix, names: R2_SECRET_NAMES } : undefined,
      cpu: 8192, // 8 vCPU (required for >30 GB; 4 vCPU tier caps at 30 GB)
      memoryMiB: 61440, // 60 GB (8 vCPU tier max) — update-metadata-dict holds three O(n²) oracle matrices (~16 GB off-heap, invisible to --max_old_space_size) plus the growing metadatadict heap (~36 GB cap). 30 GB was OOM-killed (exit 137) as the oracle count grew; 60 GB leaves runway for the quadratic growth
    });

    // Compute ECS networking config (same logic as card-update-monitor-lambda)
    const subnets = vpc.privateSubnets.length > 0 ? vpc.privateSubnets : vpc.publicSubnets;
    const subnetIds = subnets.map((subnet) => subnet.subnetId);
    const usePublicSubnets = vpc.privateSubnets.length === 0;

    // Create everything we need related to ElasticBeanstalk, including the environment and the application
    const serverEnvVars = createEnvironmentVariables(params, props, dynamoTables.table.tableName, mlServiceUrl);
    serverEnvVars.ECS_CLUSTER_NAME = fargateCluster.clusterName;
    serverEnvVars.ECS_TASK_DEFINITION_ARN = jobsTask.taskDefinition.taskDefinitionArn;
    serverEnvVars.ECS_SUBNET_IDS = cdk.Fn.join(',', subnetIds);
    serverEnvVars.ECS_ASSIGN_PUBLIC_IP = usePublicSubnets ? 'ENABLED' : 'DISABLED';
    // Static assets + card images are served from Cloudflare R2 at this hostname
    // (assets.<domain> is an R2 custom domain managed in Cloudflare DNS).
    serverEnvVars.CDN_BASE_URL = `https://assets.${params.domain}`;
    // Where the server publishes draft ids for async bot-deck building.
    serverEnvVars.BOT_DECKBUILD_TOPIC_ARN = botDeckbuildLambda.topic.topicArn;
    // Queue/DLQ/function names so the admin deckbuild dashboard can read CloudWatch metrics
    // (SQS queue depth + Lambda success rate) via GetMetricData.
    serverEnvVars.BOT_DECKBUILD_QUEUE_NAME = botDeckbuildLambda.queue.queueName;
    serverEnvVars.BOT_DECKBUILD_DLQ_NAME = botDeckbuildLambda.deadLetterQueue.queueName;
    serverEnvVars.BOT_DECKBUILD_FUNCTION_NAME = botDeckbuildLambda.lambdaFunction.functionName;

    const elasticBeanstalk = new ElasticBeanstalk(this, 'ElasticBeanstalk', {
      certificate: cert.consoleCertificate,
      vpc,
      environmentName: params.environmentName,
      environmentVariables: serverEnvVars,
      fleetSize: params.fleetSize,
      instanceProfile: instanceProfile,
      appBucket: s3Buckets.appBucket,
      appVersion: params.version,
      restrictIngressToCloudflare: params.restrictAlbToCloudflare,
    });

    // Grant the server's instance role permissions to run and monitor ECS tasks
    const taskFamily = `cubecobra-jobs-${params.environmentName}`;
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [`arn:aws:ecs:${props?.env?.region}:${props?.env?.account}:task-definition/${taskFamily}:*`],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeTasks', 'ecs:ListTasks'],
        resources: ['*'],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [jobsTask.taskRole.roleArn, jobsTask.executionRole.roleArn],
        conditions: {
          StringEquals: {
            'iam:PassedToService': 'ecs-tasks.amazonaws.com',
          },
        },
      }),
    );

    new Route53(this, 'Route53', {
      dnsName: elasticBeanstalk.environment.attrEndpointUrl,
      domain: params.domain,
      recordSetId: 'ConsoleAliasRecord', // Keep the same ID as before to avoid resource replacement
    });

    // Register all the scheduled jobs we have
    params.jobs?.forEach((jobProps, jobName) => {
      new ScheduledJob(this, jobName, fargateCluster, ecr.repository, jobProps);
    });

    // Create the daily jobs lambda with environment variables
    // Lambda uses execution role for AWS credentials, not access keys
    const lambdaEnvVars = createLambdaEnvironmentVariables(params, props, dynamoTables.table.tableName);

    // The daily rotations (ManaMatrix, Synergy Connect, crossword) authenticate to this stage's
    // server with MANAMATRIX_API_KEY; it is the lambda's only secret.
    new DailyJobsLambdaConstruct(this, 'DailyJobsLambda', {
      codeArtifactsBucket: params.appBucket,
      version: params.version,
      subdomain: params.domain.split('.')[0],
      stage: params.env,
      environmentVariables: secretsPrefix
        ? lambdaEnvVars
        : { ...lambdaEnvVars, MANAMATRIX_API_KEY: params.manaMatrixApiKey },
      ssmSecrets: secretsPrefix ? { prefix: secretsPrefix, names: DAILY_JOBS_SECRET_NAMES } : undefined,
      table: dynamoTables.table,
      dataBucket: params.dataBucket,
    });

    // Create the card update monitor lambda (runs every 5 minutes). It needs no secrets: it only
    // reads task records and starts ECS tasks.
    new CardUpdateMonitorLambda(this, 'CardUpdateMonitorLambda', {
      codeArtifactsBucket: params.appBucket,
      version: params.version,
      subdomain: params.domain.split('.')[0],
      stage: params.env,
      environmentName: params.environmentName,
      environmentVariables: lambdaEnvVars,
      cluster: fargateCluster,
      taskDefinition: jobsTask.taskDefinition,
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
  mlServiceUrl?: string,
): {
  [key: string]: string;
} {
  // With secretsFromSsm no secret value is written here; the server loads them at startup from the
  // names in SSM_SECRET_NAMES (appended below).
  const synthesizeSecrets = !params.secretsFromSsm;
  const envVars: { [key: string]: string } = {
    AWS_LOG_GROUP: `/cubecobra/${params.environmentName}/server`,
    AWS_LOG_STREAM: 'application',
    AWS_CLIENT_ERROR_LOG_GROUP: `/cubecobra/${params.environmentName}/client/error`,
    AWS_REGION: props?.env?.region || '',
    CLOUDWATCH_ENABLED: params.environmentName === 'local' ? 'false' : 'true',
    CUBECOBRA_VERSION: params.version,
    DATA_BUCKET: params.dataBucket,
    DOMAIN: params.domain,
    DOWNTIME_ACTIVE: params.downTimeActive ? 'true' : 'false',
    DYNAMO_PREFIX: params.dynamoPrefix,
    ENV: params.env,
    NODE_ENV: params.environmentName === 'local' ? 'development' : 'production',
    NITROPAY_ENABLED: params.nitroPayEnabled ? 'true' : 'false',
    PATREON_CLIENT_ID: params.patreonClientId,
    ...(synthesizeSecrets
      ? { PATREON_CLIENT_SECRET: params.patreonClientSecret, PATREON_HOOK_SECRET: params.patreonHookSecret }
      : {}),
    PATREON_REDIRECT: params.patreonRedirect,
    PORT: '8080',
    ...(synthesizeSecrets ? { SESSION: params.sessionToken } : {}),
    USE_S3: 'true',
    CAPTCHA_SITE_KEY: params.captchaSiteKey,
    ...(synthesizeSecrets ? { CAPTCHA_SECRET_KEY: params.captchaSecretKey } : {}),
    GA_MEASUREMENT_ID: params.gaMeasurementId,
    ...(synthesizeSecrets
      ? {
          GA_API_SECRET: params.gaApiSecret,
          DRAFTMANCER_API_KEY: params.draftmancerApiKey,
          MANAMATRIX_API_KEY: params.manaMatrixApiKey,
          STRIPE_SECRET_KEY: params.stripeSecretKey,
        }
      : {}),
    STRIPE_PUBLIC_KEY: params.stripePublicKey,
    ENABLE_BOT_SECURITY: params.enableBotSecurity ? 'true' : 'false',
    CLEAR_SITE_CACHE: params.clearSiteCache ? 'true' : 'false',
    MAINTAIN_CUBE_CARD_HASHES: params.maintainCubeCardHashes ? 'true' : 'false',
    // Sent to the recommender on every request; empty (until the SSM parameter exists) = auth disabled.
    ...(synthesizeSecrets ? { RECOMMENDER_SHARED_SECRET: params.recommenderSharedSecret } : {}),
  };

  // Add DYNAMO_TABLE if it's provided
  if (dynamoTableName) {
    envVars.DYNAMO_TABLE = dynamoTableName;
  }

  // Add ML_SERVICE_URL if provided (internal ALB URL for VPC-internal communication)
  if (mlServiceUrl) {
    envVars.ML_SERVICE_URL = mlServiceUrl;
  }

  // R2 config for the server's hosted-image upload pipeline (packages/server/src/serverutils/
  // hostedImageStorage.ts -> r2.ts). Without these the server's r2Configured() is false while
  // CDN_BASE_URL is set, so storeImage() throws "misconfigured" and every upload fails. Only set
  // when the stage has been cut over to R2 (params are empty otherwise), mirroring the jobs env.
  if (params.r2Endpoint) envVars.R2_ENDPOINT = params.r2Endpoint;
  if (synthesizeSecrets && params.r2AccessKeyId) envVars.R2_ACCESS_KEY_ID = params.r2AccessKeyId;
  if (synthesizeSecrets && params.r2SecretAccessKey) envVars.R2_SECRET_ACCESS_KEY = params.r2SecretAccessKey;
  if (params.r2Bucket) envVars.R2_BUCKET = params.r2Bucket;

  // The server needs the card image host to allowlist it in the image proxy
  // (packages/server/src/router/routes/tool/imageproxy.ts), which the Print &
  // Play PDF export uses to fetch self-hosted card images without CORS issues.
  if (params.cardImageBaseUrl) envVars.CARD_IMAGE_BASE_URL = params.cardImageBaseUrl;

  if (!synthesizeSecrets) {
    Object.assign(
      envVars,
      ssmSecretsEnvironment({
        prefix: ssmSecretsPrefixFor(params.environmentName),
        // The R2 keys are required exactly when the stage has R2 configured (R2_ENDPOINT above).
        names: [...WEB_SERVER_SECRET_NAMES, ...(params.r2Endpoint ? R2_SECRET_NAMES : [])],
      }),
    );
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
    // Stage discriminator so the monitor lambda can gate prod-only jobs off on
    // beta/local — exports write to the shared cubecobra-public bucket, which the
    // beta jobs role has no access to, so they must not run outside production.
    STAGE: params.environmentName === 'production' ? 'PROD' : params.environmentName === 'beta' ? 'BETA' : 'LOCAL',
    // Jobs that need the card catalog (ManaMatrix rotation) or the ML service
    // (P1P1 bot picks) call back into THIS stage's server. Without it the jobs
    // fall back to https://cubecobra.com, so beta would drive production.
    API_BASE_URL: params.domain === 'localhost' ? 'http://localhost:8080' : `https://${params.domain}`,
    // No secrets here: this base is shared by all three lambdas, and each adds only the secrets
    // its own code reads (none of them reads DRAFTMANCER_API_KEY).
    ENABLE_BOT_SECURITY: params.enableBotSecurity ? 'true' : 'false',
    MAINTAIN_CUBE_CARD_HASHES: params.maintainCubeCardHashes ? 'true' : 'false',
  };

  // Add DYNAMO_TABLE if it's provided
  if (dynamoTableName) {
    envVars.DYNAMO_TABLE = dynamoTableName;
  }

  return envVars;
}

function createRecommenderEnvironmentVariables(
  params: CubeCobraStackParams,
  props: StackProps | undefined,
): {
  [key: string]: string;
} {
  const envVars: { [key: string]: string } = {
    AWS_REGION: props?.env?.region || '',
    DATA_BUCKET: params.dataBucket,
    NODE_ENV: params.environmentName === 'local' ? 'development' : 'production',
    PORT: '8080',
    LOG_GROUP_NAME: `/cubecobra/${params.environmentName}/recommender/application`,
    LOG_STREAM_NAME: 'default',
    // Required on incoming requests when non-empty; empty = auth disabled.
    ...(params.secretsFromSsm
      ? ssmSecretsEnvironment({
          prefix: ssmSecretsPrefixFor(params.environmentName),
          names: RECOMMENDER_SECRET_NAMES,
        })
      : { RECOMMENDER_SHARED_SECRET: params.recommenderSharedSecret }),
  };

  return envVars;
}

function createJobsEnvironmentVariables(
  params: CubeCobraStackParams,
  props: StackProps | undefined,
  dynamoTableName?: string,
): {
  [key: string]: string;
} {
  // Map environmentName to STAGE (beta -> BETA, production -> PROD)
  let stage = 'BETA';
  if (params.environmentName === 'production') {
    stage = 'PROD';
  } else if (params.environmentName === 'beta') {
    stage = 'BETA';
  }

  const envVars: { [key: string]: string } = {
    AWS_REGION: props?.env?.region || '',
    CLOUDWATCH_ENABLED: 'false',
    DATA_BUCKET: params.dataBucket,
    DYNAMO_DB_PREFIX: params.dynamoPrefix,
    NODE_ENV: params.environmentName === 'local' ? 'development' : 'production',
    STAGE: stage,
  };

  // Add DYNAMO_TABLE if it's provided
  if (dynamoTableName) {
    envVars.DYNAMO_TABLE = dynamoTableName;
  }

  // R2 config for sync_card_images and the self-hosted image URLs emitted by
  // update_cards. Only set when the stage has been cut over to R2 (params are
  // empty otherwise), so unconfigured stages keep their existing behavior.
  // With secretsFromSsm the keys are task-definition secrets instead (see JobsEcsTask ssmSecrets).
  if (params.r2Endpoint) envVars.R2_ENDPOINT = params.r2Endpoint;
  if (!params.secretsFromSsm && params.r2AccessKeyId) envVars.R2_ACCESS_KEY_ID = params.r2AccessKeyId;
  if (!params.secretsFromSsm && params.r2SecretAccessKey) envVars.R2_SECRET_ACCESS_KEY = params.r2SecretAccessKey;
  if (params.r2Bucket) envVars.R2_BUCKET = params.r2Bucket;
  if (params.cardImageBaseUrl) envVars.CARD_IMAGE_BASE_URL = params.cardImageBaseUrl;

  return envVars;
}
