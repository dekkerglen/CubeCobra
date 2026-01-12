#!/usr/bin/env ts-node
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';

import { environments } from '../config';
import { DeploymentPipeline } from '../lib/deployment-pipeline';

const app = new cdk.App();

// Pipeline is always deployed to the same account/region
const pipelineConfig = environments.production;

const githubOwner = process.env.GITHUB_OWNER || 'dekkerglen';
const githubRepo = process.env.GITHUB_REPO || 'CubeCobra';
const githubBranch = process.env.GITHUB_BRANCH || 'master';
const codestarConnectionArn = process.env.CODESTAR_CONNECTION_ARN || '';

if (!codestarConnectionArn) {
  throw new Error(
    'CODESTAR_CONNECTION_ARN environment variable is required. ' +
      'Create a connection in AWS Console: Developer Tools > Settings > Connections',
  );
}

const pipelineStack = new cdk.Stack(app, 'CubeCobraPipelineStack', {
  env: {
    account: pipelineConfig.account,
    region: pipelineConfig.region,
  },
  description: 'CubeCobra Deployment Pipeline',
});

new DeploymentPipeline(pipelineStack, 'DeploymentPipeline', {
  githubOwner,
  githubRepo,
  githubBranch,
  codestarConnectionArn,
  betaDomain: environments.beta.domain,
  productionDomain: environments.production.domain,
  account: pipelineConfig.account,
  region: pipelineConfig.region,
});

app.synth();
