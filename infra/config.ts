export interface EnvironmentConfiguration {
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
}

export const environments: { [key: string]: EnvironmentConfiguration } = {
  development: {
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
  },

  production: {
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
    fleetSize: 1,
  },
};
