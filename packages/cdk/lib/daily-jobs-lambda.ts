import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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
  // This stage's single table (DYNAMO_TABLE) and data bucket (DATA_BUCKET) -- the only DynamoDB
  // and S3 resources the lambda's code touches.
  table: dynamodb.ITable;
  dataBucket: string;
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
      code: lambda.Code.fromBucket(codeBucket, `dailyJobsLambda/${props.version}.zip`),
      handler: 'handler.handler',
      environment: props.environmentVariables,
      timeout: cdk.Duration.minutes(15), // Jobs may take longer
      memorySize: 1024,
      role: executionRole,
    });

    // DynamoDB: item-level read/write on this stage's table and its GSIs only. The jobs go through
    // the server's DAO layer (dynamo/dao/BaseDynamoDao.ts), which issues Get/Put/Update/Delete,
    // Query, Scan, BatchGet/BatchWrite and TransactWrite (covered by the item actions plus
    // ConditionCheckItem). No table-management actions (CreateTable/DeleteTable/...).
    executionRole.addToPolicy(
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

    // S3: this stage's data bucket only (cube cards, drafts, P1P1 packs). Every S3 call in the
    // bundled code (server dynamo/s3client.ts helpers) targets DATA_BUCKET.
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [`arn:aws:s3:::${props.dataBucket}`, `arn:aws:s3:::${props.dataBucket}/*`],
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
