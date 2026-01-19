import { ScheduledJobProps } from './scheduled-job';

export interface CubeCobraStackParams {
  accessKey: string;
  secretKey: string;
  domain: string;
  version: string;
  environmentName: string;
  awsLogGroup: string;
  awsLogStream: string;
  dataBucket: string;
  appBucket: string;
  downTimeActive: boolean;
  dynamoPrefix: string;
  env: Environment;
  jobsToken: string;
  nitroPayEnabled: boolean;
  patreonClientId: string;
  patreonClientSecret: string;
  patreonHookSecret: string;
  patreonRedirect: string;
  sessionToken: string;
  sessionSecret: string;
  fleetSize: number;
  jobs?: Map<string, ScheduledJobProps>;
  captchaSiteKey: string;
  captchaSecretKey: string;
  draftmancerApiKey: string;
  stripeSecretKey: string;
  stripePublicKey: string;
  enableBotSecurity: boolean;
  maintainCubeCardHashes: boolean;
}

export type Environment = 'production' | 'development' | 'local';
