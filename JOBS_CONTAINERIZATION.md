# Jobs Containerization Implementation

## Overview

This implementation containerizes the CubeCobra jobs execution, moving from local npm scripts to ECS Fargate tasks with CDK-managed deployment.

## What Was Changed

### 1. Docker Configuration

**File: `packages/jobs/Dockerfile`**

- Multi-stage build using Node.js 20.18.0
- Installs dependencies for jobs, server, and utils packages
- Builds all TypeScript projects
- Configurable command execution via CMD override
- Default: `npm run update-all`

**File: `packages/jobs/.dockerignore`**

- Excludes unnecessary files from Docker build
- Reduces image size and build time

### 2. CDK Infrastructure

**File: `packages/cdk/lib/jobs-ecs-task.ts` (NEW)**

- Creates ECS Fargate task definition for jobs
- Configures task execution role (for pulling images, writing logs)
- Configures task role (for accessing S3, DynamoDB)
- Sets up CloudWatch Logs group `/ecs/cubecobra-jobs`
- Outputs task definition ARN and ECR repository URI
- Default resources: 2 vCPU, 16 GB RAM (configurable)

**IAM Permissions:**

- S3: Read/write to JOBS_BUCKET and DATA_BUCKET
- DynamoDB: Full access to tables with DYNAMO_DB_PREFIX
- ECR: Pull container images
- CloudWatch: Write logs

**File: `packages/cdk/lib/cubecobra-stack.ts`**

- Added `jobsBucket` parameter to stack configuration
- Creates separate ECR repository for jobs container
- Instantiates JobsEcsTask construct with environment variables
- Passes environment variables: AWS_REGION, DATA_BUCKET, JOBS_BUCKET, DYNAMO_DB_PREFIX, NODE_ENV

**File: `packages/cdk/config.ts`**

- Added `jobsBucket` field to EnvironmentConfiguration interface
- Configured job bucket names for each environment:
  - local: `cubecobra-jobs-local`
  - development: `cubecobra-jobs-dev`
  - beta: `cubecobra-jobs-beta`
  - production: `cubecobra-jobs-prod`

**File: `packages/cdk/app/infra.ts`**

- Added `jobsBucket` parameter when instantiating CubeCobraStack

### 3. Deployment Pipeline

**File: `packages/cdk/lib/deployment-pipeline.ts`**

**Changes to Beta Deploy:**

- Added Docker build/push steps after CDK deployment
- Retrieves ECR repository URI from CloudFormation stack outputs
- Builds image with Dockerfile at `packages/jobs/Dockerfile`
- Tags image with git commit SHA and `latest`
- Pushes both tags to ECR

**Changes to Production Deploy:**

- Same Docker build/push steps as beta
- Uses production stack name and ECR repository

**IAM Permissions Added:**

- ECR permissions for both beta and prod deploy projects:
  - `ecr:GetAuthorizationToken`
  - `ecr:BatchCheckLayerAvailability`
  - `ecr:GetDownloadUrlForLayer`
  - `ecr:BatchGetImage`
  - `ecr:PutImage`
  - `ecr:InitiateLayerUpload`
  - `ecr:UploadLayerPart`
  - `ecr:CompleteLayerUpload`

### 4. Documentation

**File: `packages/jobs/CONTAINER.md`**

- Comprehensive guide for building and running the container
- Environment variable documentation
- Local development instructions
- ECS deployment guide
- Monitoring and logging information

## Deployment Flow

1. **Code pushed to GitHub** → Triggers CodePipeline
2. **Source stage** → Checks out code from GitHub
3. **Build stage** → Runs npm install, npm run ci-build
4. **Deploy stage** (Beta/Prod):
   - Publishes server artifact to S3
   - Builds and publishes Lambda function
   - **Deploys CDK stack** (creates/updates ECR, ECS task definition)
   - **Builds Docker image** from `packages/jobs/Dockerfile`
   - **Pushes image to ECR** with commit SHA and `latest` tags
   - ECS task definition automatically references latest image

## Running Jobs

### Via AWS CLI

```bash
aws ecs run-task \
  --cluster <cluster-name> \
  --task-definition cubecobra-jobs \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[...],securityGroups=[...],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"JobsContainer","command":["npm","run","update-cards"]}]}'
```

### Via AWS Console

1. Navigate to ECS → Clusters → Select cluster
2. Click "Run new task"
3. Select `cubecobra-jobs` task definition
4. Override command: `["npm", "run", "update-cards"]`
5. Click "Run task"

### Available Commands

- `npm run update-all` - All jobs (default)
- `npm run update-cards` - Card database
- `npm run update-combos` - Combo data
- `npm run update-metadata-dict` - Metadata dictionary
- `npm run update-cube-history` - Cube history
- `npm run update-draft-history` - Draft history

## Environment Variables

The container receives these environment variables from the ECS task definition:

- `AWS_REGION` - AWS region (from CDK props)
- `DATA_BUCKET` - S3 bucket for card data (from config)
- `JOBS_BUCKET` - S3 bucket for job state (from config)
- `DYNAMO_DB_PREFIX` - DynamoDB table prefix (from config)
- `DYNAMO_TABLE` - DynamoDB table name (from stack)
- `NODE_ENV` - Node environment (development/production)
- `CLOUDWATCH_ENABLED` - Set to 'false' for jobs

## Monitoring

**CloudWatch Logs:**

- Log group: `/ecs/cubecobra-jobs`
- Stream prefix: `jobs`
- Retention: 7 days

**View logs:**

```bash
aws logs tail /ecs/cubecobra-jobs --follow
```

## Next Steps

### 1. Create S3 Buckets

Before deploying, create the jobs buckets in AWS:

```bash
aws s3 mb s3://cubecobra-jobs-beta --region us-east-2
aws s3 mb s3://cubecobra-jobs-prod --region us-east-2
```

### 2. Deploy to Beta

The next deployment to beta will:

1. Create the ECR repository for jobs
2. Create the ECS task definition
3. Build and push the Docker image
4. Make the task available for execution

### 3. Trigger Initial Job Run

After deployment, manually trigger the initial data update:

```bash
# Update cards (includes manifest creation)
aws ecs run-task ... --overrides '{"containerOverrides":[{"name":"JobsContainer","command":["npm","run","update-cards"]}]}'

# Update other data
aws ecs run-task ... --overrides '{"containerOverrides":[{"name":"JobsContainer","command":["npm","run","update-all"]}]}'
```

### 4. Schedule Jobs (Optional)

To run jobs on a schedule, you can:

- Use AWS EventBridge rules to trigger ECS tasks
- Create a Lambda function to trigger tasks
- Use the existing ScheduledJob construct in CDK

### 5. Retire npm Scripts

Once containerized jobs are working reliably:

- Remove job execution from server startup
- Keep manifest checking in server for card updates
- Run all heavy processing as ECS tasks instead of server-side

## Benefits

1. **Isolation**: Jobs run in separate containers, not on web servers
2. **Scalability**: Can run multiple jobs concurrently on different tasks
3. **Resources**: Jobs get dedicated CPU/memory (2 vCPU, 16 GB)
4. **Reliability**: Failed tasks can be retried without affecting web servers
5. **Monitoring**: Centralized logging in CloudWatch
6. **Cost**: Pay only when jobs are running (Fargate spot for further savings)
7. **Version Control**: Job code versioned with git commit SHA
8. **Rollback**: Easy to revert to previous image version if needed
