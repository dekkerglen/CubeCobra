import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

import type { MlPipelineConfig } from '../config';
import { ECR } from './ecr';

export interface MlPipelineProps {
  config: MlPipelineConfig;
  environmentName: string;
  vpc: ec2.IVpc;
  // The jobs image (packages/jobs/Dockerfile): the CPU stages are npm scripts in packages/jobs.
  jobsRepository: ecr.IRepository;
  // The jobs task's environment (cubecobra-stack.ts createJobsEnvironmentVariables).
  jobsEnvironmentVariables: { [key: string]: string };
  // DYNAMO_TABLE and friends, so the lambda's retrainTaskDao works (createLambdaEnvironmentVariables).
  lambdaEnvironmentVariables: { [key: string]: string };
  table: dynamodb.ITable;
  // This stack's data bucket: holds the training runs (ml/runs/) and the live model.
  dataBucket: string;
  codeArtifactsBucket: string;
  version: string;
  subdomain: string;
  stage: string;
}

// Training instances in order of preference. Both are 8 vCPU / 32 GiB / 1 GPU (A10G, then L4 when
// g5 capacity is short), so either fits the GPU task definition.
const GPU_INSTANCE_TYPES = ['g5.2xlarge', 'g6.2xlarge'];

// The instances' 32 GiB less ~2 GiB for the OS and the ECS agent.
const GPU_TASK_MEMORY_MIB = 30 * 1024;

// Verify calls, a minute apart, before a promotion counts as failed and is reverted (each makes
// 20 requests; see the lambda).
const VERIFY_ATTEMPTS = 20;

// The environments the publish step mirrors the model to in R2, in publish order, and the SSM
// parameters (/cubecobra/<segment>/...) each ML_R2_<TARGET>_<SUFFIX> variable is read from.
const R2_TARGETS = ['production', 'beta'] as const;
const R2_PARAMETERS: { [suffix: string]: string } = {
  ENDPOINT: 'r2-endpoint',
  BUCKET: 'r2-bucket',
  ACCESS_KEY_ID: 'r2-access-key-id',
  SECRET_ACCESS_KEY: 'r2-secret-access-key',
};

// The jobs task's own R2 keys; the ML stages get per-target ML_R2_* credentials instead.
const JOBS_R2_CREDENTIALS = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];

const bucketArn = (bucket: string): string => `arn:aws:s3:::${bucket}`;
const objectArn = (bucket: string, key: string): string => `arn:aws:s3:::${bucket}/${key}`;

/**
 * Automated retraining of the recommender model, run after each 90-day export.
 *
 * A Step Functions state machine runs the stages as ECS tasks on a dedicated cluster: process data
 * (CPU) -> in parallel, train + package (GPU) and archetype topics (CPU; NMF over Scryfall oracle
 * tags, named by Claude on Bedrock, independent of the model) -> evaluate (CPU) -> gate (lambda) ->
 * publish (CPU) -> promote to beta -> admin approval on the site -> promote to production. Promoting moves model/current.json in that environment's data bucket, which its
 * recommenders poll and hot-reload, and waits until every response reports the new version (a
 * promotion that doesn't get there is reverted). Rollback is the same machine in PROMOTE mode.
 * Each run is recorded as a RetrainTask (packages/mlPipelineLambda).
 *
 * The GPU comes from an Auto Scaling group that ECS managed scaling grows from zero when a GPU
 * task is launched with this capacity provider, and shrinks back once it is idle.
 */
export class MlPipeline extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: MlPipelineProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);
    const targets = props.config.promoteTargets;
    const targetBuckets = [targets.beta.dataBucket, targets.production.dataBucket];
    const runsBucket = props.dataBucket;

    // Training image, built from packages/ml/Dockerfile by its own CodeBuild project after the
    // production deploy (deployment-pipeline.ts). It is several GB, so only recent images are kept.
    const mlEcr = new ECR(this, 'MlEcr', { maxImageCount: 10 });
    this.repository = mlEcr.repository;

    // The default VPC has only public subnets, so tasks and instances there need a public IP to
    // reach S3, ECR and R2 (same logic as the jobs tasks).
    const usePublicSubnets = props.vpc.privateSubnets.length === 0;
    const subnets = usePublicSubnets ? props.vpc.publicSubnets : props.vpc.privateSubnets;

    // A cluster of its own, so the shared Fargate cluster's callers never see the GPU capacity
    // provider. The CPU stages run here on Fargate too.
    const cluster = new ecs.Cluster(this, 'MlCluster', { vpc: props.vpc });

    // ---------------------------------------------------------------------------------------------
    // GPU capacity
    // ---------------------------------------------------------------------------------------------

    const gpuSecurityGroup = new ec2.SecurityGroup(this, 'GpuInstanceSg', {
      vpc: props.vpc,
      description: 'ML GPU instances: egress only',
      allowAllOutbound: true,
    });

    // ECS adds the agent permissions and the ECS_CLUSTER user data (cluster.addAsgCapacityProvider;
    // the AL2023 ECS AMI takes the same /etc/ecs/ecs.config line as AL2). Containers use their task
    // role: IMDSv2 with the default hop limit of 1 keeps bridge-mode containers off the instance role.
    const gpuInstanceRole = new iam.Role(this, 'GpuInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    const gpuLaunchTemplate = new ec2.LaunchTemplate(this, 'GpuLaunchTemplate', {
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(ecs.AmiHardwareType.GPU),
      userData: ec2.UserData.forLinux(),
      role: gpuInstanceRole,
      securityGroup: gpuSecurityGroup,
      associatePublicIpAddress: usePublicSubnets,
      requireImdsv2: true,
      // Room for the multi-GB training image plus the run's data and checkpoints. /dev/xvda is the
      // AL2023 ECS AMI's root device.
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(200, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }),
        },
      ],
    });

    // No desired capacity: ECS managed scaling owns it, starting from zero.
    const gpuAutoScalingGroup = new autoscaling.AutoScalingGroup(this, 'GpuAsg', {
      vpc: props.vpc,
      vpcSubnets: { subnets },
      minCapacity: 0,
      maxCapacity: 1,
      mixedInstancesPolicy: {
        launchTemplate: gpuLaunchTemplate,
        launchTemplateOverrides: GPU_INSTANCE_TYPES.map((type) => ({ instanceType: new ec2.InstanceType(type) })),
        instancesDistribution: {
          // On-demand only, trying the instance types in the order above.
          onDemandAllocationStrategy: autoscaling.OnDemandAllocationStrategy.PRIORITIZED,
          onDemandBaseCapacity: 0,
          onDemandPercentageAboveBaseCapacity: 100,
        },
      },
    });

    // Managed scaling only launches an instance for tasks started with a capacity provider strategy
    // naming this provider (a plain launchType EC2 RunTask fails with no instances), which is how
    // the GPU stages below run. Termination protection stays off so the idle instance scales in.
    const gpuCapacityProvider = new ecs.AsgCapacityProvider(this, 'GpuCapacityProvider', {
      autoScalingGroup: gpuAutoScalingGroup,
      enableManagedScaling: true,
      targetCapacityPercent: 100,
      enableManagedTerminationProtection: false,
    });
    cluster.addAsgCapacityProvider(gpuCapacityProvider);

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/cubecobra-ml-${props.environmentName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ---------------------------------------------------------------------------------------------
    // GPU task: training and packaging (packages/ml)
    // ---------------------------------------------------------------------------------------------

    const gpuTaskRole = new iam.Role(this, 'GpuTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    gpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:AbortMultipartUpload'],
        resources: [objectArn(runsBucket, 'ml/runs/*')],
      }),
    );
    // The live model, read-only.
    gpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [objectArn(runsBucket, 'model/*')],
      }),
    );
    // Bucket-wide rather than prefix-conditioned: without ListBucket in effect for the bucket, a
    // read of a missing key fails 403 instead of 404, and the stages test for missing files.
    gpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucketArn(runsBucket)],
      }),
    );

    // Bridge networking: awsvpc tasks on EC2 can't get a public IP, so they would have no route out.
    const gpuTaskDefinition = new ecs.Ec2TaskDefinition(this, 'GpuTaskDefinition', {
      family: `cubecobra-ml-gpu-${props.environmentName}`,
      networkMode: ecs.NetworkMode.BRIDGE,
      taskRole: gpuTaskRole,
    });
    const gpuContainer = gpuTaskDefinition.addContainer('MlGpuContainer', {
      image: ecs.ContainerImage.fromEcrRepository(mlEcr.repository, 'latest'),
      gpuCount: 1,
      memoryReservationMiB: GPU_TASK_MEMORY_MIB,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'gpu', logGroup }),
      environment: {
        ML_RUNS_BUCKET: runsBucket,
        AWS_REGION: stack.region,
      },
    });

    // ---------------------------------------------------------------------------------------------
    // CPU task: data processing, evaluation and publishing (packages/jobs/src/ml)
    // ---------------------------------------------------------------------------------------------

    const cpuTaskRole = new iam.Role(this, 'CpuTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    cpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [objectArn(props.config.exportBucket, 'export/*')],
      }),
    );
    cpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:AbortMultipartUpload'],
        resources: [objectArn(runsBucket, 'ml/runs/*')],
      }),
    );
    // The live model (evaluation baseline), and the card catalog the daily card update writes, which
    // data processing reads each card's oracle tags from. Publish writes model/<version>/ to every
    // promote target's bucket.
    cpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [objectArn(runsBucket, 'model/*'), objectArn(runsBucket, 'cards/*')],
      }),
    );
    cpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:AbortMultipartUpload'],
        resources: targetBuckets.map((bucket) => objectArn(bucket, 'model/*')),
      }),
    );
    // Moving model/current.json is promotion, which only the pipeline lambda does.
    cpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ['s3:PutObject'],
        resources: targetBuckets.map((bucket) => objectArn(bucket, 'model/current.json')),
      }),
    );
    // Bucket-wide for the same 404-vs-403 reason as the GPU task role.
    cpuTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [...new Set([props.config.exportBucket, runsBucket, ...targetBuckets])].map(bucketArn),
      }),
    );

    // The data step holds the card catalog and a ~6 GB card x card co-occurrence matrix, and writes
    // its shards to disk.
    const cpuTaskDefinition = new ecs.FargateTaskDefinition(this, 'CpuTaskDefinition', {
      family: `cubecobra-ml-cpu-${props.environmentName}`,
      cpu: 8192,
      memoryLimitMiB: 61440,
      ephemeralStorageGiB: 200,
      taskRole: cpuTaskRole,
    });

    // R2 settings for every target come from that environment's SSM parameters (the beta ones
    // aren't known when production synthesizes), injected by ECS at container start. ECS grants
    // the execution role read access to exactly these parameters.
    const cpuSecrets: { [key: string]: ecs.Secret } = {};
    for (const target of R2_TARGETS) {
      for (const [suffix, parameter] of Object.entries(R2_PARAMETERS)) {
        const variable = `ML_R2_${target.toUpperCase()}_${suffix}`;
        cpuSecrets[variable] = ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(this, `${variable}Parameter`, {
            parameterName: `/cubecobra/${targets[target].ssmSegment}/${parameter}`,
          }),
        );
      }
    }

    const cpuContainer = cpuTaskDefinition.addContainer('MlCpuContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.jobsRepository, 'latest'),
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'cpu', logGroup }),
      environment: {
        ...Object.fromEntries(
          Object.entries(props.jobsEnvironmentVariables).filter(([name]) => !JOBS_R2_CREDENTIALS.includes(name)),
        ),
        ML_RUNS_BUCKET: runsBucket,
        ML_EXPORT_BUCKET: props.config.exportBucket,
        ML_LIVE_BUCKET: runsBucket,
        ML_PUBLISH_BUCKETS: [targets.beta.dataBucket, targets.production.dataBucket].join(','),
        ML_R2_TARGETS: R2_TARGETS.join(','),
      },
      secrets: cpuSecrets,
    });

    const cpuSecurityGroup = new ec2.SecurityGroup(this, 'CpuTaskSg', {
      vpc: props.vpc,
      description: 'ML CPU tasks: egress only',
      allowAllOutbound: true,
    });

    // ---------------------------------------------------------------------------------------------
    // Topics task: archetype topics on the training image, CPU only (packages/ml, ccml.topics)
    // ---------------------------------------------------------------------------------------------

    const topicsTaskRole = new iam.Role(this, 'TopicsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    topicsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:AbortMultipartUpload'],
        resources: [objectArn(runsBucket, 'ml/runs/*')],
      }),
    );
    // The live model bundle, read-only.
    topicsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [objectArn(runsBucket, 'model/*')],
      }),
    );
    // Bucket-wide for the same 404-vs-403 reason as the GPU task role.
    topicsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucketArn(runsBucket)],
      }),
    );
    // Naming the topics: the Anthropic SDK's Bedrock Mantle client posts to
    // bedrock-mantle.<region>.api.aws/anthropic/v1/messages, which is authorized by
    // bedrock-mantle:CreateInference on the model. The model ARN format for this action isn't
    // documented anywhere available here, so this isn't scoped to the two model ids yet.
    topicsTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock-mantle:CreateInference'],
        resources: ['*'],
      }),
    );

    const topicsTaskDefinition = new ecs.FargateTaskDefinition(this, 'TopicsTaskDefinition', {
      family: `cubecobra-ml-topics-${props.environmentName}`,
      cpu: 8192,
      memoryLimitMiB: 32768,
      // Fargate counts the multi-GB training image against this too.
      ephemeralStorageGiB: 100,
      taskRole: topicsTaskRole,
    });
    const topicsContainer = topicsTaskDefinition.addContainer('MlTopicsContainer', {
      image: ecs.ContainerImage.fromEcrRepository(mlEcr.repository, 'latest'),
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'topics', logGroup }),
      environment: {
        ML_RUNS_BUCKET: runsBucket,
        ML_LIVE_BUCKET: runsBucket,
        AWS_REGION: stack.region,
        // Bedrock in the stack's own region (us-east-2).
        ML_BEDROCK_REGION: stack.region,
        ML_BEDROCK_MODEL_ID: props.config.bedrockModelId,
        ML_BEDROCK_FALLBACK_MODEL_ID: props.config.bedrockFallbackModelId,
      },
    });

    // ---------------------------------------------------------------------------------------------
    // Lambdas (packages/mlPipelineLambda): one bundle, two functions
    // ---------------------------------------------------------------------------------------------

    const codeBucket = s3.Bucket.fromBucketName(this, 'CodeBucket', props.codeArtifactsBucket);
    const code = lambda.Code.fromBucket(codeBucket, `mlPipelineLambda/${props.version}.zip`);
    const lambdaEnvironment = {
      ...props.lambdaEnvironmentVariables,
      ML_RUNS_BUCKET: runsBucket,
      ML_PROMOTE_TARGETS: JSON.stringify(targets),
    };

    // Outside the VPC: DynamoDB, S3 and Elastic Beanstalk over their public endpoints.
    const pipelineRole = new iam.Role(this, 'PipelineFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:ConditionCheckItem',
        ],
        resources: [props.table.tableArn, `${props.table.tableArn}/index/*`],
      }),
    );
    // The run's gate and archetype reports.
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [objectArn(runsBucket, 'ml/runs/*')],
      }),
    );
    // Promotion: check the version exists, then move the pointer (or, reverting to the legacy
    // layout, remove it).
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: targetBuckets.map((bucket) => objectArn(bucket, 'model/*')),
      }),
    );
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: targetBuckets.map((bucket) => objectArn(bucket, 'model/current.json')),
      }),
    );
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [...new Set([runsBucket, ...targetBuckets])].map(bucketArn),
      }),
    );
    // The recommender environments' status (not mid-deploy) and internal endpoint.
    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['elasticbeanstalk:DescribeEnvironments'],
        resources: ['*'],
      }),
    );

    const pipelineFunction = new lambda.Function(this, 'PipelineFunction', {
      functionName: `MlPipeline-${props.subdomain}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      code,
      handler: 'handler.handler',
      environment: lambdaEnvironment,
      timeout: Duration.minutes(2),
      memorySize: 512,
      role: pipelineRole,
    });

    // Inside the VPC: it only makes HTTP requests to the recommenders' internal ALBs (same-VPC
    // route), so a public-subnet ENI without internet access is fine.
    const verifyRole = new iam.Role(this, 'VerifyFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });
    const verifySecurityGroup = new ec2.SecurityGroup(this, 'VerifyFunctionSg', {
      vpc: props.vpc,
      description: 'ML pipeline verify lambda: reaches the internal recommender ALBs',
      allowAllOutbound: true,
    });
    const verifyFunction = new lambda.Function(this, 'VerifyFunction', {
      functionName: `MlPipelineVerify-${props.subdomain}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      code,
      handler: 'handler.handler',
      // Same environment: the bundle loads the DAOs at startup, though this function never calls them.
      environment: lambdaEnvironment,
      timeout: Duration.minutes(2),
      memorySize: 256,
      role: verifyRole,
      vpc: props.vpc,
      vpcSubnets: { subnets },
      securityGroups: [verifySecurityGroup],
      allowPublicSubnet: usePublicSubnets,
    });

    // ---------------------------------------------------------------------------------------------
    // State machine
    // ---------------------------------------------------------------------------------------------
    //
    // State: the execution input plus `run` ({ runId, version, mode } from Prepare), `gate`,
    // `promotion` (the promote/verify loop) and, once something fails, `error`. Everything else
    // discards its result so `run` is always there.

    const runId = sfn.JsonPath.stringAt('$.run.runId');
    const runVersion = sfn.JsonPath.stringAt('$.run.version');

    // Error only: a caught error always has one, but not always a Cause (e.g. a SendTaskFailure
    // without one), and a missing path would fail this state. The cause is in the execution history
    // and, summarized, on the RetrainTask.
    const failed = new sfn.Fail(this, 'Failed', { errorPath: '$.error.Error' });

    // Marks the RetrainTask failed (a rejected run stays REJECTED), then fails the execution with
    // the original error, which the ExecutionsFailed alarm below picks up.
    const recordFailure = new tasks.LambdaInvoke(this, 'RecordFailure', {
      lambdaFunction: pipelineFunction,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({
        action: 'fail',
        runId,
        error: sfn.JsonPath.objectAt('$.error'),
      }),
      resultPath: sfn.JsonPath.DISCARD,
    });
    recordFailure.addCatch(failed, { resultPath: '$.recordFailureError' });
    recordFailure.next(failed);

    const guard = <T extends sfn.TaskStateBase>(state: T, onError: sfn.IChainable = recordFailure): T => {
      state.addCatch(onError, { resultPath: '$.error' });
      return state;
    };

    // onError null: no catch, for states inside the Parallel below. Those can't transition out of
    // their branch; an error fails the branch, and the Parallel's own catch takes it from there.
    const invoke = (
      stateId: string,
      payload: { [key: string]: unknown },
      resultPath: string = sfn.JsonPath.DISCARD,
      onError: sfn.IChainable | null = recordFailure,
    ) => {
      const state = new tasks.LambdaInvoke(this, stateId, {
        lambdaFunction: pipelineFunction,
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject(payload),
        resultPath,
      });
      return onError ? guard(state, onError) : state;
    };

    // Records the stage the run is entering on its RetrainTask.
    const step = (stateId: string, name: string, onError: sfn.IChainable | null = recordFailure) =>
      invoke(stateId, { action: 'step', runId, step: name }, sfn.JsonPath.DISCARD, onError);

    // Routes to RecordFailure with an error of our own.
    const failWith = (stateId: string, error: string, cause: string) =>
      new sfn.Pass(this, stateId, {
        parameters: { Error: error, Cause: cause },
        resultPath: '$.error',
      }).next(recordFailure);

    const runIdOverride = [{ name: 'ML_RUN_ID', value: runId }];

    const cpuStage = (stateId: string, script: string, timeout: Duration) =>
      guard(
        new tasks.EcsRunTask(this, stateId, {
          integrationPattern: sfn.IntegrationPattern.RUN_JOB,
          cluster,
          taskDefinition: cpuTaskDefinition,
          launchTarget: new tasks.EcsFargateLaunchTarget({ platformVersion: ecs.FargatePlatformVersion.LATEST }),
          subnets: { subnets },
          assignPublicIp: usePublicSubnets,
          securityGroups: [cpuSecurityGroup],
          containerOverrides: [
            { containerDefinition: cpuContainer, command: ['npm', 'run', script], environment: runIdOverride },
          ],
          taskTimeout: sfn.Timeout.duration(timeout),
          resultPath: sfn.JsonPath.DISCARD,
        }),
      );

    // Inside the Parallel, so no catch of its own (see invoke).
    const gpuStage = (stateId: string, pythonModule: string, timeout: Duration) => {
      const state = new tasks.EcsRunTask(this, stateId, {
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        cluster,
        taskDefinition: gpuTaskDefinition,
        launchTarget: new tasks.EcsEc2LaunchTarget({
          capacityProviderOptions: tasks.CapacityProviderOptions.custom([
            { capacityProvider: gpuCapacityProvider.capacityProviderName, weight: 1 },
          ]),
        }),
        containerOverrides: [
          { containerDefinition: gpuContainer, command: ['python', '-m', pythonModule], environment: runIdOverride },
        ],
        taskTimeout: sfn.Timeout.duration(timeout),
        resultPath: sfn.JsonPath.DISCARD,
      });
      // RunTask errors here mean no GPU capacity yet (no g5/g6 to be had); wait them out. This
      // retrier comes first because States.TaskFailed below matches every error but timeouts.
      state.addRetry({
        errors: ['ECS.AmazonECSException'],
        interval: Duration.minutes(10),
        maxAttempts: 6,
        backoffRate: 1,
      });
      return state;
    };

    // Promote `target`, then poll its recommender until every response reports the new version.
    // Each recommender instance polls model/current.json every 60 s and hot-reloads, so verifying
    // starts a minute after the move and gives up after VERIFY_ATTEMPTS checks a minute apart.
    //
    // Once the pointer may have moved (Promote failing, Verify failing or giving up), the failure
    // goes through Revert before RecordFailure: it puts this target's pointer back if it still names
    // this run's version, so instances that start later don't load the failed version. Each flow
    // reverts only its own target (a failed production promotion leaves beta on the new version).
    // A failing Revert still continues to RecordFailure.
    const promoteFlow = (name: string, target: 'beta' | 'production', stepName: string, next: sfn.IChainable) => {
      const revert = new tasks.LambdaInvoke(this, `Revert${name}`, {
        lambdaFunction: pipelineFunction,
        payloadResponseOnly: true,
        payload: sfn.TaskInput.fromObject({ action: 'revert', runId, version: runVersion, target }),
        resultPath: sfn.JsonPath.DISCARD,
      });
      revert.addCatch(recordFailure, { resultPath: '$.revertError' });
      revert.next(recordFailure);

      const promote = invoke(
        `Promote${name}`,
        { action: 'promote', runId, version: runVersion, target },
        '$.promotion',
        revert,
      );
      // Thrown before the pointer moves while the environment is mid-deploy.
      promote.addRetry({
        errors: ['EnvironmentNotReady'],
        interval: Duration.minutes(1),
        maxAttempts: 30,
        backoffRate: 1,
      });

      const verify = guard(
        new tasks.LambdaInvoke(this, `Verify${name}`, {
          lambdaFunction: verifyFunction,
          payloadResponseOnly: true,
          payload: sfn.TaskInput.fromObject({
            action: 'verify',
            target: sfn.JsonPath.stringAt('$.promotion.target'),
            version: sfn.JsonPath.stringAt('$.promotion.version'),
            url: sfn.JsonPath.stringAt('$.promotion.url'),
            previousVersion: sfn.JsonPath.stringAt('$.promotion.previousVersion'),
            attempts: sfn.JsonPath.numberAt('$.promotion.attempts'),
          }),
          resultPath: '$.promotion',
        }),
        revert,
      );

      const serving = new sfn.Choice(this, `${name}Serving`)
        .when(sfn.Condition.booleanEquals('$.promotion.ready', true), next)
        .when(
          sfn.Condition.numberGreaterThanEquals('$.promotion.attempts', VERIFY_ATTEMPTS),
          new sfn.Pass(this, `${name}NotServing`, {
            parameters: {
              Error: 'VerifyFailed',
              Cause: sfn.JsonPath.format(
                `The ${target} recommender never served {} on every request`,
                sfn.JsonPath.stringAt('$.promotion.version'),
              ),
            },
            resultPath: '$.error',
          }).next(revert),
        )
        .otherwise(
          new sfn.Wait(this, `Wait${name}Again`, { time: sfn.WaitTime.duration(Duration.seconds(60)) }).next(verify),
        );

      return sfn.Chain.start(step(`StepPromoting${name}`, stepName))
        .next(promote)
        .next(new sfn.Wait(this, `Wait${name}Reload`, { time: sfn.WaitTime.duration(Duration.seconds(60)) }))
        .next(verify)
        .next(serving);
    };

    // Production: shared by TRAIN (after approval) and PROMOTE (started by an admin from the site,
    // which is the approval).
    const finish = sfn.Chain.start(invoke('Finalize', { action: 'finalize', runId })).next(
      new sfn.Succeed(this, 'Succeeded'),
    );
    const promoteProduction = promoteFlow('Production', 'production', 'Promoting production', finish);

    // Waits for the admin's decision: the web server calls SendTaskSuccess or SendTaskFailure with
    // the stored token. A rejection or the timeout fails the state into RecordFailure.
    const awaitApproval = guard(
      new tasks.LambdaInvoke(this, 'AwaitApproval', {
        lambdaFunction: pipelineFunction,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: sfn.TaskInput.fromObject({ action: 'awaitApproval', runId, taskToken: sfn.JsonPath.taskToken }),
        taskTimeout: sfn.Timeout.duration(Duration.days(7)),
        resultPath: sfn.JsonPath.DISCARD,
      }),
    );

    const promoteBeta = promoteFlow(
      'Beta',
      'beta',
      'Promoting beta',
      sfn.Chain.start(step('StepAwaitingApproval', 'Awaiting approval')).next(awaitApproval).next(promoteProduction),
    );

    const publish = cpuStage('Publish', 'ml-publish', Duration.hours(1));
    publish.addRetry({ errors: ['States.TaskFailed'], interval: Duration.minutes(2), maxAttempts: 1 });

    // The trainer resumes from its latest S3 checkpoint, so a failed attempt loses at most an epoch.
    const train = gpuStage('Train', 'ccml.train', Duration.hours(72));
    train.addRetry({ errors: ['States.TaskFailed'], interval: Duration.minutes(5), maxAttempts: 3, backoffRate: 2 });

    const packageModel = gpuStage('Package', 'ccml.package', Duration.hours(2));
    packageModel.addRetry({ errors: ['States.TaskFailed'], interval: Duration.minutes(2), maxAttempts: 1 });

    // Archetype topics only need the processed data, not the model, so they run alongside training.
    // No catch of its own (inside the Parallel, see invoke).
    const topics = new tasks.EcsRunTask(this, 'Topics', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      cluster,
      taskDefinition: topicsTaskDefinition,
      launchTarget: new tasks.EcsFargateLaunchTarget({ platformVersion: ecs.FargatePlatformVersion.LATEST }),
      subnets: { subnets },
      assignPublicIp: usePublicSubnets,
      securityGroups: [cpuSecurityGroup],
      containerOverrides: [
        { containerDefinition: topicsContainer, command: ['python', '-m', 'ccml.topics'], environment: runIdOverride },
      ],
      taskTimeout: sfn.Timeout.duration(Duration.hours(3)),
      resultPath: sfn.JsonPath.DISCARD,
    });
    topics.addRetry({ errors: ['States.TaskFailed'], interval: Duration.minutes(2), maxAttempts: 1 });

    // Training records its steps on the run; the topics branch records none, so the two branches
    // never flip the run's step back and forth. If either branch fails, the other is stopped and
    // the Parallel's catch records the failure. $ comes out unchanged.
    const trainAndTopics = new sfn.Parallel(this, 'TrainAndTopics', { resultPath: sfn.JsonPath.DISCARD })
      .branch(
        sfn.Chain.start(step('StepTraining', 'Training', null))
          .next(train)
          .next(step('StepPackaging', 'Packaging', null))
          .next(packageModel),
      )
      .branch(topics);
    trainAndTopics.addCatch(recordFailure, { resultPath: '$.error' });

    const gate = invoke('Gate', { action: 'gate', runId }, '$.gate');

    const trainFlow = sfn.Chain.start(step('StepProcessing', 'Processing data'))
      .next(cpuStage('ProcessData', 'ml-process-data', Duration.hours(3)))
      .next(trainAndTopics)
      .next(step('StepEvaluating', 'Evaluating'))
      .next(cpuStage('Evaluate', 'ml-evaluate', Duration.hours(3)))
      .next(step('StepGate', 'Gate'))
      .next(gate)
      .next(
        new sfn.Choice(this, 'GatePassed')
          .when(
            sfn.Condition.booleanEquals('$.gate.passed', true),
            sfn.Chain.start(step('StepPublishing', 'Publishing')).next(publish).next(promoteBeta),
          )
          .otherwise(failWith('GateFailed', 'GateFailed', 'The candidate model did not pass the promotion gate')),
      );

    // Creates the RetrainTask. Before it exists there is nothing to mark failed.
    const prepare = new tasks.LambdaInvoke(this, 'Prepare', {
      lambdaFunction: pipelineFunction,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({
        action: 'prepare',
        input: sfn.JsonPath.entirePayload,
        executionArn: sfn.JsonPath.executionId,
      }),
      resultPath: '$.run',
    });
    prepare.addCatch(failed, { resultPath: '$.error' });

    const definition = sfn.Chain.start(prepare).next(
      new sfn.Choice(this, 'Mode')
        .when(sfn.Condition.stringEquals('$.run.mode', 'promote'), promoteProduction)
        .otherwise(trainFlow),
    );

    this.stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: `cubecobra-ml-pipeline-${props.environmentName}`,
      stateMachineType: sfn.StateMachineType.STANDARD,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
    });

    // The admin page is the primary notification; the topic is there to subscribe to if wanted.
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `cubecobra-ml-pipeline-${props.environmentName}`,
    });
    const failedAlarm = new cloudwatch.Alarm(this, 'ExecutionsFailedAlarm', {
      alarmDescription: 'An ML retraining run failed (or was rejected)',
      metric: this.stateMachine.metricFailed({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    failedAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));

    new cdk.CfnOutput(this, 'MlPipelineStateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'ARN of the ML retraining state machine',
    });
  }

  /**
   * Lets the web server start runs (training or promotion), follow and stop them, and answer the
   * approval step.
   */
  public grantRunControl(grantee: iam.IGrantable): void {
    this.stateMachine.grantStartExecution(grantee);
    this.stateMachine.grantExecution(grantee, 'states:DescribeExecution', 'states:StopExecution');
    // Task responses take no resource-level permissions; holding the task token is what authorizes.
    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['states:SendTaskSuccess', 'states:SendTaskFailure'],
        resources: ['*'],
      }),
    );
  }
}
