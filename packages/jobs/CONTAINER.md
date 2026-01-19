# CubeCobra Jobs Container

This directory contains the Docker configuration for running CubeCobra data update jobs as containerized ECS tasks.

## Overview

The jobs container runs the various update scripts that maintain CubeCobra's card database and analytics:

- `update-cards` - Download and process Scryfall card data
- `update-combos` - Fetch Commander Spellbook combo data
- `update-metadata-dict` - Calculate card correlations and metadata
- `update-cube-history` - Track cube composition changes over time
- `update-draft-history` - Process draft history incrementally

All data is stored in S3 buckets for persistence across runs.

## Building the Container

From the repository root:

```bash
docker build -t cubecobra-jobs:latest -f packages/jobs/Dockerfile .
```

## Running Locally

```bash
docker run --rm \
  -e AWS_REGION=us-east-2 \
  -e DATA_BUCKET=cubecobra-data-production \
  -e JOBS_BUCKET=cubecobra-jobs-dev \
  -e DYNAMO_DB_PREFIX=DEV \
  -e AWS_ACCESS_KEY_ID=your-access-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret-key \
  cubecobra-jobs:latest \
  npm run update-cards
```

Replace `npm run update-cards` with any other job script name to run different updates.

## Environment Variables

- `AWS_REGION` - AWS region (e.g., us-east-2)
- `DATA_BUCKET` - S3 bucket for card data
- `JOBS_BUCKET` - S3 bucket for job state and incremental data
- `DYNAMO_DB_PREFIX` - Prefix for DynamoDB tables (DEV, BETA, PROD)
- `DYNAMO_TABLE` - (Optional) DynamoDB table name
- `NODE_ENV` - Node environment (development or production)

## Running on ECS

The container is automatically deployed to ECS via the CDK deployment pipeline. To manually trigger a job:

```bash
aws ecs run-task \
  --cluster CubeCobra-Cluster \
  --task-definition cubecobra-jobs \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"JobsContainer","command":["npm","run","update-cards"]}]}'
```

## CDK Deployment

The container is built and published during the CDK deployment process:

1. CDK deploys the infrastructure (ECS cluster, ECR repo, task definition)
2. CodeBuild builds the Docker image from `packages/jobs/Dockerfile`
3. Image is tagged with the git commit SHA and `latest`
4. Image is pushed to the ECR repository
5. ECS task definition is updated to use the new image

## Available Commands

- `npm run update-all` - Run all update scripts sequentially (default)
- `npm run update-cards` - Update card database
- `npm run update-combos` - Update combo data
- `npm run update-metadata-dict` - Update metadata dictionary
- `npm run update-cube-history` - Update cube history
- `npm run update-draft-history` - Update draft history

## Monitoring

Logs are sent to CloudWatch Logs group `/ecs/cubecobra-jobs`.

To view logs:

```bash
aws logs tail /ecs/cubecobra-jobs --follow
```
