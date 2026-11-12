// An environment the ML retraining pipeline promotes models to (lib/ml-pipeline.ts).
export interface MlPromoteTarget {
  // The environment's data bucket: the pipeline publishes model/<version>/ there and moves
  // model/current.json to promote.
  dataBucket: string;
  // The environment's recommender Elastic Beanstalk environment (lib/recommender-service.ts),
  // restarted after a promotion so it loads the new model.
  recommenderEnvironmentName: string;
  // SSM path segment of the environment's /cubecobra/<segment>/r2-* parameters (lib/secrets.ts
  // ssmSegmentFor); the publish step mirrors the model to that environment's R2 bucket.
  ssmSegment: string;
}

export interface MlPipelineConfig {
  // Bucket the 90-day export job writes export/ to; the pipeline trains on it.
  exportBucket: string;
  // Bedrock models that name the archetype topics; the fallback is only used when the main model
  // refuses.
  bedrockModelId: string;
  bedrockFallbackModelId: string;
  // Region of the Bedrock Mantle endpoint the naming calls go to. For this account, us-east-2 and
  // us-west-2 answer 404 "model does not exist" for Opus 5.5 and 4.8; us-east-1 serves them.
  bedrockRegion: string;
  promoteTargets: {
    beta: MlPromoteTarget;
    production: MlPromoteTarget;
  };
}

export interface EnvironmentConfiguration {
  stackName: string;
  account: string;
  region: string;
  dataBucket: string;
  appBucket: string;
  domain: string;
  awsLogGroup: string;
  awsLogStream: string;
  downTimeActive: boolean;
  dynamoPrefix: string;
  nitroPayEnabled: boolean;
  patreonRedirectUri: string;
  fleetSize: number;
  maintainCubeCardHashes: boolean;
  // dev/beta/production all share ONE default VPC (same account + region), and gateway
  // endpoints are per-VPC. Exactly one environment's BootstrapStack owns the shared
  // S3/DynamoDB gateway endpoints; every environment's in-VPC compute uses them. Only the
  // owner has this true (beta, which already created them). If beta is ever decommissioned,
  // flip this to another shared-VPC env.
  manageSharedVpcEndpoints: boolean;
  // Opt-in (M-11): restrict the public web ALB's 80/443 ingress to Cloudflare's published IP
  // ranges (see CLOUDFLARE_IPV4/IPV6_RANGES in lib/elastic-beanstalk.ts), so the origin can't be
  // reached around Cloudflare and the server's trust in CF-Connecting-IP holds. Before enabling:
  // confirm every DNS record that points at this environment is proxied (orange cloud) and that
  // nothing calls the ALB / EB hostname directly; then flip it on for beta, verify, then prod.
  // Immutable deploys can't carry load balancer changes: see "Elastic Beanstalk settings and
  // immutable deploys" in the README for how to roll it out.
  restrictAlbToCloudflare: boolean;
  // Load application secrets at runtime from SSM SecureStrings under
  // /cubecobra/<beta|prod>/secrets/<ENV_VAR_NAME> instead of synthesizing them into the
  // CloudFormation/EB/Lambda/ECS configuration and the CodeBuild environment (see lib/secrets.ts).
  // Create every parameter before flipping this on; beta first, then production, following
  // packages/docs/maintenance/secrets-migration.md.
  secretsFromSsm: boolean;
  // ML retraining pipeline (lib/ml-pipeline.ts). Set on production only: one pipeline trains on
  // the production export and promotes to beta, then (after admin approval) production.
  mlPipeline?: MlPipelineConfig;
}

export const environments: { [key: string]: EnvironmentConfiguration } = {
  local: {
    stackName: 'CubeCobraLocalStack',
    account: '000000000000',
    region: 'us-east-1',
    dataBucket: 'local',
    appBucket: 'app-code',
    domain: 'localhost',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'DEVELOPMENT',
    downTimeActive: false,
    dynamoPrefix: 'LOCAL',
    nitroPayEnabled: false,
    patreonRedirectUri: 'http://localhost:8080/patreon/redirect',
    fleetSize: 1,
    maintainCubeCardHashes: true,
    manageSharedVpcEndpoints: false,
    restrictAlbToCloudflare: false,
    secretsFromSsm: false,
  },

  development: {
    stackName: 'CubeCobraDevStack',
    account: '816705121310',
    region: 'us-east-2',
    // WARNING: this is the PRODUCTION data bucket. Anything deployed or run with
    // environment=development reads and writes production S3 data (the IAM grants in
    // cubecobra-stack.ts follow dataBucket). Point it at a dev/beta bucket before using it.
    dataBucket: 'cubecobra-data-production',
    appBucket: 'cubecobra',
    domain: 'cubecobradev.com',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'DEVELOPMENT',
    downTimeActive: false,
    dynamoPrefix: 'DEV',
    nitroPayEnabled: false,
    patreonRedirectUri: 'https://cubecobradev.com/patreon/redirect',
    fleetSize: 1,
    maintainCubeCardHashes: true,
    manageSharedVpcEndpoints: false,
    restrictAlbToCloudflare: false,
    secretsFromSsm: false,
  },

  beta: {
    stackName: 'CubeCobraBetaStack',
    account: '816705121310',
    region: 'us-east-2',
    dataBucket: 'cubecobra-data-beta',
    appBucket: 'cubecobra',
    domain: 'cubecobradev.com',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'BETA',
    downTimeActive: false,
    dynamoPrefix: 'BETA',
    nitroPayEnabled: false,
    patreonRedirectUri: 'https://cubecobradev.com/patreon/redirect',
    fleetSize: 1,
    maintainCubeCardHashes: true,
    manageSharedVpcEndpoints: true,
    restrictAlbToCloudflare: false,
    secretsFromSsm: false,
  },

  production: {
    stackName: 'CubeCobraProdStack',
    account: '816705121310',
    region: 'us-east-2',
    dataBucket: 'cubecobra-data-production',
    appBucket: 'cubecobra',
    domain: 'cubecobra.com',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'PRODUCTION',
    downTimeActive: false,
    dynamoPrefix: 'PROD',
    nitroPayEnabled: true,
    patreonRedirectUri: 'https://cubecobra.com/patreon/redirect',
    fleetSize: 3,
    maintainCubeCardHashes: true,
    manageSharedVpcEndpoints: false,
    restrictAlbToCloudflare: false,
    secretsFromSsm: false,
    mlPipeline: {
      exportBucket: 'cubecobra-public',
      bedrockModelId: 'anthropic.claude-opus-5-5',
      bedrockFallbackModelId: 'anthropic.claude-opus-4-8',
      bedrockRegion: 'us-east-1',
      promoteTargets: {
        beta: {
          dataBucket: 'cubecobra-data-beta',
          recommenderEnvironmentName: 'cubecobra-recommender-beta-v2-env',
          ssmSegment: 'beta',
        },
        production: {
          dataBucket: 'cubecobra-data-production',
          recommenderEnvironmentName: 'cubecobra-recommender-production-v2-env',
          ssmSegment: 'prod',
        },
      },
    },
  },
};
