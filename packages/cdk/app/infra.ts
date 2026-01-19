#!/usr/bin/env ts-node
// use dotenv
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import * as cdk from 'aws-cdk-lib';

import 'source-map-support/register';

import { environments } from '../config';
import { BootstrapStack } from '../lib/bootstrap-stack';
import { CubeCobraStack } from '../lib/cubecobra-stack';
import { CubeCobraStackLocal } from '../lib/cubecobra-stack-local';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment');
if (!environment || !environments[environment]) {
  throw new Error(`Invalid or missing environment. Available environments: ${Object.keys(environments).join(', ')}`);
}

const config = environments[environment];
const isLocal = environment === 'local';

const bootstrap = app.node.tryGetContext('bootstrap');
if (bootstrap && bootstrap === 'true') {
  console.log(`Bootstrapping environment '${environment}'`);
  new BootstrapStack(app, `BootstrapStack${environment}`, {
    env: { account: config.account, region: config.region },
  });
} else {
  const version = app.node.tryGetContext('version');
  if (!version || version === '') {
    throw new Error('Invalid or missing version. Version should be "v1.2.3"');
  }

  console.log(`Deploying CubeCobra stack to '${environment}'`);
  const StackClass = isLocal ? CubeCobraStackLocal : CubeCobraStack;

  new StackClass(
    app,
    config.stackName,
    {
      accessKey: process.env.AWS_ACCESS_KEY_ID || '',
      secretKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      domain: config.domain,
      environmentName: environment,
      version: version,
      awsLogGroup: config.awsLogGroup,
      awsLogStream: config.awsLogStream,
      dataBucket: config.dataBucket,
      appBucket: config.appBucket,
      downTimeActive: config.downTimeActive,
      dynamoPrefix: config.dynamoPrefix,
      env: environment,
      jobsToken: process.env.JOBS_TOKEN || '',
      nitroPayEnabled: config.nitroPayEnabled,
      patreonClientId: process.env.PATREON_CLIENT_ID || '',
      patreonClientSecret: process.env.PATREON_CLIENT_SECRET || '',
      patreonHookSecret: process.env.PATREON_HOOK_SECRET || '',
      patreonRedirect: config.patreonRedirectUri,
      sessionToken: process.env.SESSION_TOKEN || '',
      sessionSecret: process.env.SESSION_SECRET || '',
      fleetSize: config.fleetSize,
      captchaSiteKey: process.env.CAPTCHA_SITE_KEY || '',
      captchaSecretKey: process.env.CAPTCHA_SECRET_KEY || '',
      draftmancerApiKey: process.env.DRAFTMANCER_API_KEY || '',
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
      enableBotSecurity: environment === 'production',
      maintainCubeCardHashes: config.maintainCubeCardHashes,
    },
    {
      env: { account: config.account, region: config.region },
    },
  );
}
