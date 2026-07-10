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
  },

  development: {
    stackName: 'CubeCobraDevStack',
    account: '816705121310',
    region: 'us-east-2',
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
  },
};
