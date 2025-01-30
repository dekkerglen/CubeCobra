#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import 'source-map-support/register';

import { environments } from '../config';
import { CubeCobraStack } from '../lib/cubecobra-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment');
const version = app.node.tryGetContext('version');

if (!environment || !environments[environment]) {
  throw new Error(`Invalid or missing environment. Available environments: ${Object.keys(environments).join(', ')}`);
}

if (!version || version === '') {
  throw new Error('Invalid or missing version. Version should be "v1.2.3"');
}

const config = environments[environment];

console.log(`Environment: ${JSON.stringify(config)}`);

new CubeCobraStack(
  app,
  config.stackName,
  {
    accessKey: process.env.AWS_ACCESS_KEY_ID || '',
    secretKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    emailUser: process.env.EMAIL_USER || '',
    emailPass: process.env.EMAIL_PASS || '',
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
    tcgPlayerPublicKey: process.env.TCG_PLAYER_PUBLIC_KEY || '',
    tcgPlayerPrivateKey: process.env.TCG_PLAYER_PRIVATE_KEY || '',
    fleetSize: config.fleetSize,
    captchaSiteKey: process.env.CAPTCHA_SITE_KEY || '',
    captchaSecretKey: process.env.CAPTCHA_SECRET_KEY || '',
    draftmancerApiKey: process.env.DRAFTMANCER_API_KEY || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
  },
  {
    env: { account: config.account, region: config.region },
  },
);
