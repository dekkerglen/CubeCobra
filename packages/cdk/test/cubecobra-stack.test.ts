import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

import { CubeCobraStack } from '../lib/cubecobra-stack';

// Mock HostedZone.fromLookup() to return a fake hosted zone (Vpc.fromLookup falls back to its dummy VPC).
jest.spyOn(route53.HostedZone, 'fromLookup').mockImplementation(
  (_scope: Construct, _id: string, _props: route53.HostedZoneProviderProps) =>
    ({
      hostedZoneId: 'Z123456ABCDEF',
    }) as route53.IHostedZone,
);

// Distinct sentinel values so a leak of any secret into the template is detectable.
const SECRET_VALUES = {
  patreonClientSecret: 'sentinel-patreon-client-secret',
  patreonHookSecret: 'sentinel-patreon-hook-secret',
  sessionToken: 'sentinel-session-token',
  captchaSecretKey: 'sentinel-captcha-secret-key',
  gaApiSecret: 'sentinel-ga-api-secret',
  draftmancerApiKey: 'sentinel-draftmancer-api-key',
  manaMatrixApiKey: 'sentinel-manamatrix-api-key',
  stripeSecretKey: 'sentinel-stripe-secret-key',
  r2AccessKeyId: 'sentinel-r2-access-key-id',
  r2SecretAccessKey: 'sentinel-r2-secret-access-key',
};

interface BuildOptions {
  r2?: boolean;
  secrets?: Partial<typeof SECRET_VALUES>;
}

const buildTemplate = (recommenderSharedSecret: string, options: BuildOptions = {}): Template => {
  const app = new cdk.App();
  const secrets = { ...SECRET_VALUES, ...options.secrets };
  const stack = new CubeCobraStack(
    app,
    'CubeCobraTestStack',
    {
      domain: 'example.com',
      environmentName: 'production',
      version: 'v1.0.0',
      awsLogGroup: 'CUBECOBRA',
      awsLogStream: 'PRODUCTION',
      dataBucket: 'test-data-bucket',
      appBucket: 'test-app-bucket',
      downTimeActive: false,
      dynamoPrefix: 'TEST',
      env: 'production',
      nitroPayEnabled: false,
      patreonClientId: 'patreon-client-id',
      patreonClientSecret: secrets.patreonClientSecret,
      patreonHookSecret: secrets.patreonHookSecret,
      patreonRedirect: 'https://example.com/patreon/redirect',
      sessionToken: secrets.sessionToken,
      fleetSize: 1,
      captchaSiteKey: 'captcha-site-key',
      captchaSecretKey: secrets.captchaSecretKey,
      gaMeasurementId: 'ga-measurement-id',
      gaApiSecret: secrets.gaApiSecret,
      draftmancerApiKey: secrets.draftmancerApiKey,
      manaMatrixApiKey: secrets.manaMatrixApiKey,
      stripeSecretKey: secrets.stripeSecretKey,
      stripePublicKey: 'stripe-public-key',
      enableBotSecurity: true,
      clearSiteCache: false,
      maintainCubeCardHashes: true,
      r2Endpoint: options.r2 ? 'https://r2.example.com' : '',
      r2AccessKeyId: options.r2 ? secrets.r2AccessKeyId : '',
      r2SecretAccessKey: options.r2 ? secrets.r2SecretAccessKey : '',
      r2Bucket: options.r2 ? 'r2-bucket' : '',
      cardImageBaseUrl: options.r2 ? 'https://images.example.com' : '',
      manageSharedVpcEndpoints: false,
      restrictAlbToCloudflare: false,
    },
    { env: { account: '123456789012', region: 'us-east-2' } },
  );
  return Template.fromStack(stack);
};

test('The daily jobs lambda has no wildcard DynamoDB or S3 access', () => {
  const template = buildTemplate('');
  const policies = template.findResources('AWS::IAM::Policy');
  const dailyJobs = Object.entries(policies).filter(([id]) => id.startsWith('DailyJobsLambda'));
  expect(dailyJobs.length).toBeGreaterThan(0);
  for (const [, policy] of dailyJobs as [string, any][]) {
    for (const statement of policy.Properties.PolicyDocument.Statement) {
      expect([statement.Resource].flat()).not.toContain('*');
    }
  }
});
