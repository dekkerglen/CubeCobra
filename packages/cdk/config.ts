export interface EnvironmentConfiguration {
  stackName: string;
  account: string;
  region: string;
  dataBucket: string;
  appBucket: string;
  jobsBucket: string;
  domain: string;
  awsLogGroup: string;
  awsLogStream: string;
  downTimeActive: boolean;
  dynamoPrefix: string;
  nitroPayEnabled: boolean;
  patreonRedirectUri: string;
  fleetSize: number;
  maintainCubeCardHashes: boolean;
}

export const environments: { [key: string]: EnvironmentConfiguration } = {
  local: {
    stackName: 'CubeCobraLocalStack',
    account: '000000000000',
    region: 'us-east-1',
    dataBucket: 'local',
    appBucket: 'app-code',
    jobsBucket: 'cubecobra-jobs-local',
    domain: 'localhost',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'DEVELOPMENT',
    downTimeActive: false,
    dynamoPrefix: 'LOCAL',
    nitroPayEnabled: false,
    patreonRedirectUri: 'http://localhost:8080/patreon/redirect',
    fleetSize: 1,
    maintainCubeCardHashes: true,
  },

  development: {
    stackName: 'CubeCobraDevStack',
    account: '816705121310',
    region: 'us-east-2',
    dataBucket: 'cubecobra-data-production',
    appBucket: 'cubecobra',
    jobsBucket: 'cubecobra-jobs-dev',
    domain: 'cubecobradev.com',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'DEVELOPMENT',
    downTimeActive: false,
    dynamoPrefix: 'DEV',
    nitroPayEnabled: false,
    patreonRedirectUri: 'https://cubecobradev.com/patreon/redirect',
    fleetSize: 1,
    maintainCubeCardHashes: true,
  },

  beta: {
    stackName: 'CubeCobraBetaStack',
    account: '816705121310',
    region: 'us-east-2',
    dataBucket: 'cubecobra-data-beta',
    appBucket: 'cubecobra',
    jobsBucket: 'cubecobra-jobs-beta',
    domain: 'cubecobradev.com',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'BETA',
    downTimeActive: false,
    dynamoPrefix: 'BETA',
    nitroPayEnabled: false,
    patreonRedirectUri: 'https://cubecobradev.com/patreon/redirect',
    fleetSize: 1,
    maintainCubeCardHashes: true,
  },

  production: {
    stackName: 'CubeCobraProdStack',
    account: '816705121310',
    region: 'us-east-2',
    dataBucket: 'cubecobra-data-production',
    appBucket: 'cubecobra',
    jobsBucket: 'cubecobra-jobs-prod',
    domain: 'cubecobra.com',
    awsLogGroup: 'CUBECOBRA',
    awsLogStream: 'PRODUCTION',
    downTimeActive: false,
    dynamoPrefix: 'PROD',
    nitroPayEnabled: true,
    patreonRedirectUri: 'https://cubecobra.com/patreon/redirect',
    fleetSize: 6,
    maintainCubeCardHashes: true,
  },
};
