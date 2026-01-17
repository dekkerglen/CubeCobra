# Card Update Monitor Lambda

This Lambda function monitors Scryfall for card updates and triggers ECS tasks to update the card database.

## Functionality

- Runs every 5 minutes via EventBridge schedule
- Checks Scryfall bulk-data API for changes
- Creates CardUpdateTask records in DynamoDB
- Triggers ECS Fargate tasks to perform the update
- Monitors task health and handles timeouts

## Environment Variables

- `AWS_REGION` - AWS region
- `DYNAMO_TABLE` - DynamoDB table name
- `DYNAMO_PREFIX` - DynamoDB table prefix
- `ECS_CLUSTER_NAME` - ECS cluster name
- `ECS_TASK_DEFINITION_ARN` - ECS task definition ARN
- `ECS_SUBNET_IDS` - Comma-separated subnet IDs
- `ECS_SECURITY_GROUP_IDS` - Comma-separated security group IDs (optional)

## Building

```bash
npm run build
```

## Deployment

The lambda is deployed via CDK in the `card-update-monitor-lambda.ts` construct.
