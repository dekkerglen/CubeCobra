import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CardUpdateMonitorLambdaProps extends StackProps {
  codeArtifactsBucket: string;
  version: string;
  subdomain: string;
  stage: string;
  environmentVariables: { [key: string]: string };
  cluster: ecs.ICluster;
  taskDefinitionArn: string;
  taskRole: iam.IRole;
  executionRole: iam.IRole;
  vpc: ec2.IVpc;
}

export class CardUpdateMonitorLambda extends Construct {
  lambdaFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: CardUpdateMonitorLambdaProps) {
    super(scope, id);

    // Define the execution role
    const executionRole = new iam.Role(this, 'CardUpdateMonitorLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    const codeBucket = s3.Bucket.fromBucketName(this, 'CodeBucket', props.codeArtifactsBucket);

    // Get subnet IDs for the ECS tasks
    const subnetIds = props.vpc.privateSubnets.map((subnet) => subnet.subnetId);

    this.lambdaFunction = new lambda.Function(this, 'CardUpdateMonitorLambda', {
      functionName: `CardUpdateMonitor-${props.subdomain}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromBucket(codeBucket, `cardUpdateMonitorLambda/${props.version}.zip`),
      handler: 'handler.handler',
      environment: {
        ...props.environmentVariables,
        ECS_CLUSTER_NAME: props.cluster.clusterName,
        ECS_TASK_DEFINITION_ARN: props.taskDefinitionArn,
        ECS_SUBNET_IDS: subnetIds.join(','),
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Grant DynamoDB permissions
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: [
          `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.environmentVariables.DYNAMO_DB_PREFIX}_*`,
        ],
      }),
    );

    // Grant ECS permissions to run tasks (specific to this task definition)
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [
          props.taskDefinitionArn,
          // Allow running any revision of this task family
          `${props.taskDefinitionArn.split(':').slice(0, -1).join(':')}:*`,
        ],
      }),
    );

    // Grant permissions to describe tasks (needed to check task health)
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeTasks'],
        resources: ['*'], // DescribeTasks doesn't support resource-level permissions
        conditions: {
          ArnEquals: {
            'ecs:cluster': props.cluster.clusterArn,
          },
        },
      }),
    );

    // Grant permission to pass the ECS task role and execution role
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [props.taskRole.roleArn, props.executionRole.roleArn],
        conditions: {
          StringLike: {
            'iam:PassedToService': 'ecs-tasks.amazonaws.com',
          },
        },
      }),
    );

    // Add a scheduled event to run every 5 minutes
    new events.Rule(this, 'CardUpdateMonitorSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(this.lambdaFunction)],
    });

    // Output the Lambda function ARN
    new cdk.CfnOutput(this, 'CardUpdateMonitorLambdaArn', {
      value: this.lambdaFunction.functionArn,
      description: 'ARN of the Card Update Monitor Lambda function',
      exportName: `${cdk.Stack.of(this).stackName}-CardUpdateMonitorLambdaArn`,
    });
  }
}
