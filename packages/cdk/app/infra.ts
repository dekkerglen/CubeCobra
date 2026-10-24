#!/usr/bin/env tsx
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

  // Secret values only come from the deploy environment when the stage still synthesizes them into
  // its configuration. With secretsFromSsm the services load them from SSM at runtime, so they are
  // never read here (and the pipeline no longer puts them in the build environment).
  const secret = (name: string): string => (config.secretsFromSsm ? '' : process.env[name] || '');

  new StackClass(
    app,
    config.stackName,
    {
      // No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY here on purpose: the services get AWS
      // credentials from their instance/task/execution roles. Copying the deployer's keys into
      // the runtime environment would make whatever credentials ran `cdk deploy` the server's
      // identity.
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
      nitroPayEnabled: config.nitroPayEnabled,
      patreonClientId: process.env.PATREON_CLIENT_ID || '',
      patreonClientSecret: secret('PATREON_CLIENT_SECRET'),
      patreonHookSecret: secret('PATREON_HOOK_SECRET'),
      patreonRedirect: config.patreonRedirectUri,
      sessionToken: secret('SESSION_TOKEN'),
      fleetSize: config.fleetSize,
      captchaSiteKey: process.env.CAPTCHA_SITE_KEY || '',
      captchaSecretKey: secret('CAPTCHA_SECRET_KEY'),
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      gaApiSecret: secret('GA_API_SECRET'),
      draftmancerApiKey: secret('DRAFTMANCER_API_KEY'),
      manaMatrixApiKey: secret('MANAMATRIX_API_KEY'),
      stripeSecretKey: secret('STRIPE_SECRET_KEY'),
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
      enableBotSecurity: environment === 'production',
      // Temporary: evicts browser caches poisoned on 2026-08-20. Set back to false once the
      // affected entries have aged out (~2 weeks) and remove the middleware in index.ts.
      clearSiteCache: false,
      maintainCubeCardHashes: config.maintainCubeCardHashes,
      r2Endpoint: process.env.R2_ENDPOINT || '',
      r2AccessKeyId: secret('R2_ACCESS_KEY_ID'),
      r2SecretAccessKey: secret('R2_SECRET_ACCESS_KEY'),
      r2Bucket: process.env.R2_BUCKET || '',
      cardImageBaseUrl: process.env.CARD_IMAGE_BASE_URL || '',
      manageSharedVpcEndpoints: config.manageSharedVpcEndpoints,
      // Optional shared secret the web server and bot-deckbuild lambda send to the recommender
      // (and the recommender requires). Without secretsFromSsm the pipeline reads it from SSM
      // /cubecobra/<beta|prod>/recommender-shared-secret when that parameter exists; empty
      // (the default until it is created) means recommender auth is disabled.
      recommenderSharedSecret: secret('RECOMMENDER_SHARED_SECRET'),
      restrictAlbToCloudflare: config.restrictAlbToCloudflare,
      secretsFromSsm: config.secretsFromSsm,
    },
    {
      env: { account: config.account, region: config.region },
    },
  );
}
