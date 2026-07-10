import * as cdk from 'aws-cdk-lib';
import { Duration, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface BotDeckbuildLambdaProps extends StackProps {
  codeArtifactsBucket: string;
  version: string;
  subdomain: string;
  stage: string;
  // DATA_BUCKET (job + seats S3) and DYNAMO_TABLE (draft metadata) for the lambda's env + IAM.
  environmentVariables: { [key: string]: string };
  // Internal ALB URL for the ML recommender — the lambda calls it directly from the VPC.
  mlServiceUrl: string;
  vpc: ec2.IVpc;
  // Whether THIS environment owns the shared default VPC's S3/DynamoDB gateway endpoints.
  // dev/beta/production share one default VPC (same account + region) and a gateway endpoint
  // adds a route to that VPC's shared main route table, so exactly one environment may create
  // them; the rest just use them (see config.manageSharedVpcEndpoints).
  manageSharedVpcEndpoints: boolean;
}

/**
 * Async bot-deckbuild pipeline: SNS topic -> SQS queue -> Lambda.
 *
 * The web server writes a self-contained deckbuild job to S3 and publishes the draft id. This
 * lambda (in-VPC, single concurrency) reads the job, runs the carddb-free deckbuild core
 * calling the recommender directly, and writes the built bot decks back to S3/DynamoDB. It
 * ships no card database, so it stays small and cold-starts fast; reserved concurrency 1
 * bounds ML load and lets it batch every draft in an SQS batch into one set of ML calls.
 */
export class BotDeckbuildLambda extends Construct {
  public readonly topic: sns.Topic;
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly lambdaFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BotDeckbuildLambdaProps) {
    super(scope, id);

    const deadLetterQueue = new sqs.Queue(this, 'BotDeckbuildDlq', {
      queueName: `BotDeckbuildDlq-${props.subdomain}-${props.stage}`,
      retentionPeriod: Duration.days(14),
    });
    this.deadLetterQueue = deadLetterQueue;

    // Visibility timeout must comfortably exceed the lambda timeout (AWS guidance: ~6x).
    this.queue = new sqs.Queue(this, 'BotDeckbuildQueue', {
      queueName: `BotDeckbuildQueue-${props.subdomain}-${props.stage}`,
      visibilityTimeout: Duration.minutes(30),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 3 },
    });

    this.topic = new sns.Topic(this, 'BotDeckbuildTopic', {
      topicName: `BotDeckbuildTopic-${props.subdomain}-${props.stage}`,
    });

    // Raw message delivery so the SQS body is exactly the JSON we publish ({ draftId }).
    this.topic.addSubscription(new snsSubscriptions.SqsSubscription(this.queue, { rawMessageDelivery: true }));

    // Execution role: logs + VPC ENI management, plus S3/DynamoDB below.
    const executionRole = new iam.Role(this, 'BotDeckbuildLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // DynamoDB: read + write the draft metadata item (clear botDecksPending, update seat names).
    if (props.environmentVariables.DYNAMO_TABLE) {
      executionRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
          resources: [
            `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.environmentVariables.DYNAMO_TABLE}`,
          ],
        }),
      );
    }

    // S3: read the deckbuild job + seats blob, write the updated seats blob.
    if (props.environmentVariables.DATA_BUCKET) {
      executionRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [`arn:aws:s3:::${props.environmentVariables.DATA_BUCKET}/*`],
        }),
      );
    }

    // Default egress (allow-all) lets the lambda reach the internal ML ALB (same-VPC route)
    // and, via the VPC's S3/DynamoDB gateway endpoints, those services.
    const securityGroup = new ec2.SecurityGroup(this, 'BotDeckbuildLambdaSg', {
      vpc: props.vpc,
      description: 'Bot-deckbuild lambda: reaches the internal ML ALB and AWS gateway endpoints',
      allowAllOutbound: true,
    });

    // A VPC lambda ENI has no public IP, so it reaches S3/DynamoDB via the VPC's gateway
    // endpoints. These are VPC-wide, shared infrastructure: dev/beta/production share one
    // default VPC, and a gateway endpoint adds a route to that VPC's shared main route table,
    // so ONLY the single owning environment creates them (else the others collide on that
    // route table). The non-owning environments' lambdas use the owner's endpoints. Keep the
    // construct ids stable — they back the logical ids CloudFormation already tracks.
    if (props.manageSharedVpcEndpoints) {
      props.vpc.addGatewayEndpoint('BotDeckbuildS3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
      props.vpc.addGatewayEndpoint('BotDeckbuildDynamoEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });
    }

    const codeBucket = s3.Bucket.fromBucketName(this, 'CodeBucket', props.codeArtifactsBucket);
    // The default VPC has no private subnets, so the lambda runs in public subnets. That's
    // fine here — see allowPublicSubnet below.
    const usePublicSubnets = props.vpc.privateSubnets.length === 0;
    const subnets = usePublicSubnets ? props.vpc.publicSubnets : props.vpc.privateSubnets;

    this.lambdaFunction = new lambda.Function(this, 'BotDeckbuildLambda', {
      functionName: `BotDeckbuild-${props.subdomain}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromBucket(codeBucket, `botDeckbuildLambda/${props.version}.zip`),
      handler: 'handler.handler',
      environment: {
        ...props.environmentVariables,
        ML_SERVICE_URL: props.mlServiceUrl,
      },
      // Many sequential ML calls, but no card data to load — modest memory, generous timeout,
      // and reserved concurrency 1 to bound ML load and keep the container warm across batches.
      timeout: Duration.minutes(5),
      memorySize: 512,
      reservedConcurrentExecutions: 1,
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: { subnets },
      securityGroups: [securityGroup],
      // Public-subnet ENIs can't reach the public internet, which CDK guards against — but
      // this lambda only needs the internal ML ALB (same-VPC route) and S3/DynamoDB (gateway
      // endpoints), never the internet, so acknowledge the guard.
      allowPublicSubnet: usePublicSubnets,
    });

    this.lambdaFunction.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(5),
        reportBatchItemFailures: true,
      }),
    );

    new cdk.CfnOutput(this, 'BotDeckbuildTopicArn', {
      value: this.topic.topicArn,
      description: 'ARN of the bot-deckbuild SNS topic',
      exportName: `${cdk.Stack.of(this).stackName}-BotDeckbuildTopicArn`,
    });
  }
}
