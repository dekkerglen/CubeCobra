import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DailyJobsLambdaConstructProps extends StackProps {
  codeArtifactsBucket: string;
  version: string;
  subdomain: string;
  stage: string;
  environmentVariables: { [key: string]: string };
}

export class DailyJobsLambdaConstruct extends Construct {
  lambdaFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: DailyJobsLambdaConstructProps) {
    super(scope, id);

    // Define the execution role
    const executionRole = new iam.Role(this, 'DailyJobsLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const codeBucket = s3.Bucket.fromBucketName(this, 'CodeBucket', props.codeArtifactsBucket);

    this.lambdaFunction = new lambda.Function(this, 'DailyJobsLambda', {
      functionName: `DailyJobsLambda-${props.subdomain}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromBucket(codeBucket, `DailyJobsLambda/${props.version}.zip`),
      handler: 'handler.handler',
      environment: props.environmentVariables,
      timeout: cdk.Duration.minutes(15), // Jobs may take longer
      memorySize: 1024,
      role: executionRole,
    });

    // Grant the Lambda function permissions to read/write to DynamoDB tables
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:*'],
        resources: ['*'],
      }),
    );

    // Add a daily scheduled event to the Lambda function, at midnight UTC
    new events.Rule(this, 'DailyScheduleRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '0',
        month: '*',
        weekDay: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(this.lambdaFunction)],
    });
  }
}
