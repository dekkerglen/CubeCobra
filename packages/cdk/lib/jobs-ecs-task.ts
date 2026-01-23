import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface JobsEcsTaskProps {
  /**
   * ECR repository for the jobs container
   */
  repository: ecr.IRepository;

  /**
   * ECS cluster to run the task in
   */
  cluster: ecs.ICluster;

  /**
   * Environment variables for the task
   */
  environmentVariables: { [key: string]: string };

  /**
   * VPC to run the task in (optional, will use cluster VPC if not provided)
   */
  vpc?: ec2.IVpc;

  /**
   * Security groups for the task (optional)
   */
  securityGroups?: ec2.ISecurityGroup[];

  /**
   * CPU units for the task (default: 2048 = 2 vCPU)
   */
  cpu?: number;

  /**
   * Memory for the task in MB (default: 16384 = 16 GB)
   */
  memoryMiB?: number;
}

export class JobsEcsTask extends Construct {
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly taskRole: iam.Role;
  public readonly executionRole: iam.Role;
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: JobsEcsTaskProps) {
    super(scope, id);

    this.repository = props.repository;

    // Create task execution role (for pulling images, writing logs)
    this.executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    // Grant permission to pull from ECR
    props.repository.grantPull(this.executionRole);

    // Create task role (for the running container)
    this.taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant S3 permissions for DATA_BUCKET (used for both data and job artifacts)
    this.taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [
          `arn:aws:s3:::${props.environmentVariables.DATA_BUCKET}`,
          `arn:aws:s3:::${props.environmentVariables.DATA_BUCKET}/*`,
        ],
      }),
    );

    // Grant S3 permissions for cubecobra-public bucket (only for PROD)
    if (props.environmentVariables.STAGE === 'PROD') {
      this.taskRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject', 's3:ListBucket'],
          resources: ['arn:aws:s3:::cubecobra-public', 'arn:aws:s3:::cubecobra-public/*'],
        }),
      );
    }

    // Grant DynamoDB permissions
    if (props.environmentVariables.DYNAMO_TABLE) {
      this.taskRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem',
          ],
          resources: [
            `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.environmentVariables.DYNAMO_TABLE}`,
            `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.environmentVariables.DYNAMO_TABLE}/index/*`,
          ],
        }),
      );
    }

    // Create log group
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/cubecobra-jobs`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create task definition
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: 'cubecobra-jobs',
      cpu: props.cpu || 2048, // 2 vCPU
      memoryLimitMiB: props.memoryMiB || 16384, // 16 GB
      taskRole: this.taskRole,
      executionRole: this.executionRole,
    });

    // Add container
    this.taskDefinition.addContainer('JobsContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.repository, 'latest'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'jobs',
        logGroup: logGroup,
      }),
      environment: props.environmentVariables,
      // Allow command to be overridden when running the task
      command: undefined,
    });

    // Output task definition ARN
    new cdk.CfnOutput(this, 'TaskDefinitionArn', {
      value: this.taskDefinition.taskDefinitionArn,
      description: 'ARN of the ECS task definition for jobs',
      exportName: `${cdk.Stack.of(this).stackName}-JobsTaskDefinitionArn`,
    });

    // Output ECR repository URI
    new cdk.CfnOutput(this, 'JobsEcrRepositoryUri', {
      value: props.repository.repositoryUri,
      description: 'URI of the ECR repository for jobs',
      exportName: `${cdk.Stack.of(this).stackName}-JobsEcrRepositoryUri`,
    });

    // Output cluster name for reference
    new cdk.CfnOutput(this, 'ClusterName', {
      value: props.cluster.clusterName,
      description: 'Name of the ECS cluster',
      exportName: `${cdk.Stack.of(this).stackName}-JobsClusterName`,
    });
  }

  /**
   * Grant permission to run this task
   */
  public grantRunTask(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['ecs:RunTask'],
      resourceArns: [this.taskDefinition.taskDefinitionArn],
    });
  }
}
