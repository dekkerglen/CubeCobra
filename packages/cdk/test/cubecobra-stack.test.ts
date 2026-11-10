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

const ML_PIPELINE = {
  exportBucket: 'test-public-bucket',
  promoteTargets: {
    beta: {
      dataBucket: 'test-beta-bucket',
      recommenderEnvironmentName: 'cubecobra-recommender-beta-v2-env',
      ssmSegment: 'beta',
    },
    production: {
      dataBucket: 'test-data-bucket',
      recommenderEnvironmentName: 'cubecobra-recommender-production-v2-env',
      ssmSegment: 'prod',
    },
  },
};

interface BuildOptions {
  secretsFromSsm?: boolean;
  r2?: boolean;
  secrets?: Partial<typeof SECRET_VALUES>;
  mlPipeline?: boolean;
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
      recommenderSharedSecret,
      restrictAlbToCloudflare: false,
      secretsFromSsm: options.secretsFromSsm ?? false,
      mlPipeline: options.mlPipeline ? ML_PIPELINE : undefined,
    },
    { env: { account: '123456789012', region: 'us-east-2' } },
  );
  return Template.fromStack(stack);
};

const environmentOptionNames = (template: Template, environmentName: string): Record<string, unknown> => {
  const environments = Object.values(template.findResources('AWS::ElasticBeanstalk::Environment')) as any[];
  const environment = environments.find((e) => e.Properties.EnvironmentName === environmentName);
  const settings: any[] = environment.Properties.OptionSettings;
  return Object.fromEntries(
    settings
      .filter((s) => s.Namespace === 'aws:elasticbeanstalk:application:environment')
      .map((s) => [s.OptionName, s.Value]),
  );
};

test('The web server environment no longer receives deployer AWS keys', () => {
  const env = environmentOptionNames(buildTemplate(''), 'cubecobra-production-v2-env');
  expect(env).not.toHaveProperty('AWS_ACCESS_KEY_ID');
  expect(env).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
  expect(env).toHaveProperty('DATA_BUCKET', 'test-data-bucket');
});

test('RECOMMENDER_SHARED_SECRET reaches the web server, the recommender and the bot-deckbuild lambda', () => {
  const template = buildTemplate('shared-secret');
  expect(environmentOptionNames(template, 'cubecobra-production-v2-env')).toHaveProperty(
    'RECOMMENDER_SHARED_SECRET',
    'shared-secret',
  );
  expect(environmentOptionNames(template, 'cubecobra-recommender-production-v2-env')).toHaveProperty(
    'RECOMMENDER_SHARED_SECRET',
    'shared-secret',
  );
  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'BotDeckbuild-example-production',
    Environment: { Variables: Match.objectLike({ RECOMMENDER_SHARED_SECRET: 'shared-secret' }) },
  });
});

test('RECOMMENDER_SHARED_SECRET defaults to empty (auth disabled) when not provisioned', () => {
  const template = buildTemplate('');
  expect(environmentOptionNames(template, 'cubecobra-production-v2-env')).toHaveProperty(
    'RECOMMENDER_SHARED_SECRET',
    '',
  );
  expect(environmentOptionNames(template, 'cubecobra-recommender-production-v2-env')).toHaveProperty(
    'RECOMMENDER_SHARED_SECRET',
    '',
  );
});

test('The stack no longer references the GitHub Actions role or grants it ECR access', () => {
  const template = buildTemplate('');
  expect(JSON.stringify(template.toJSON())).not.toContain('github-actions-role-arn');
  template.hasResourceProperties('AWS::ECR::Repository', { ImageScanningConfiguration: { ScanOnPush: true } });
});

test('Logs Insights StartQuery is limited to the log groups the admin dashboards query', () => {
  const template = buildTemplate('');
  const statements = Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (policy: any) => policy.Properties.PolicyDocument.Statement,
  );
  const startQuery = statements.filter((s) => [s.Action].flat().includes('logs:StartQuery'));
  expect(startQuery).toHaveLength(1);
  const base = 'arn:aws:logs:us-east-2:123456789012:log-group:/cubecobra/production';
  expect([startQuery[0].Resource].flat().sort()).toEqual(
    [
      `${base}/server/info`,
      `${base}/server/info:*`,
      `${base}/server/error`,
      `${base}/server/error:*`,
      `${base}/client/error`,
      `${base}/client/error:*`,
    ].sort(),
  );
});

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

// ---------------------------------------------------------------------------------------------
// secretsFromSsm
// ---------------------------------------------------------------------------------------------

const WEB_SERVER_SECRET_NAMES =
  'SESSION,SESSION_PREVIOUS?,RECORD_TOKEN_SECRET?,PATREON_CLIENT_SECRET,PATREON_HOOK_SECRET,PATREON_HOOK_SECRET_PREVIOUS?,' +
  'CAPTCHA_SECRET_KEY,GA_API_SECRET?,DRAFTMANCER_API_KEY,DRAFTMANCER_API_KEY_PREVIOUS?,MANAMATRIX_API_KEY,' +
  'MANAMATRIX_API_KEY_PREVIOUS?,STRIPE_SECRET_KEY?,RECOMMENDER_SHARED_SECRET?';

// Every variable that carries a secret value somewhere when the flag is off.
const SECRET_ENV_VARS = [
  'SESSION',
  'SESSION_SECRET',
  'JOBS_TOKEN',
  'PATREON_CLIENT_SECRET',
  'PATREON_HOOK_SECRET',
  'CAPTCHA_SECRET_KEY',
  'GA_API_SECRET',
  'DRAFTMANCER_API_KEY',
  'MANAMATRIX_API_KEY',
  'STRIPE_SECRET_KEY',
  'RECOMMENDER_SHARED_SECRET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];

const lambdaEnvironment = (template: Template, functionName: string): Record<string, unknown> => {
  const functions = Object.values(template.findResources('AWS::Lambda::Function')) as any[];
  return functions.find((f) => f.Properties.FunctionName === functionName).Properties.Environment.Variables;
};

const jobsContainer = (template: Template): any =>
  (Object.values(template.findResources('AWS::ECS::TaskDefinition'))[0] as any).Properties.ContainerDefinitions[0];

const policyStatements = (template: Template, idPrefix: string): any[] =>
  Object.entries(template.findResources('AWS::IAM::Policy'))
    .filter(([id]) => id.startsWith(idPrefix))
    .flatMap(([, policy]: [string, any]) => policy.Properties.PolicyDocument.Statement);

const ssmStatements = (template: Template, idPrefix: string): any[] =>
  policyStatements(template, idPrefix).filter((s) => [s.Action].flat().some((a: string) => a.startsWith('ssm:')));

const PARAM = 'arn:aws:ssm:us-east-2:123456789012:parameter/cubecobra/prod/secrets/';

describe('with secretsFromSsm', () => {
  for (const r2 of [false, true]) {
    test(`no secret value appears anywhere in the template (R2 ${r2 ? 'configured' : 'not configured'})`, () => {
      const template = buildTemplate('sentinel-recommender-shared-secret', { secretsFromSsm: true, r2 });
      const json = JSON.stringify(template.toJSON());
      for (const value of [...Object.values(SECRET_VALUES), 'sentinel-recommender-shared-secret']) {
        expect(json).not.toContain(value);
      }

      for (const name of ['cubecobra-production-v2-env', 'cubecobra-recommender-production-v2-env']) {
        const env = environmentOptionNames(template, name);
        for (const secret of SECRET_ENV_VARS) expect(env).not.toHaveProperty(secret);
      }
      for (const name of [
        'DailyJobsLambda-example-production',
        'BotDeckbuild-example-production',
        'CardUpdateMonitor-example-production',
      ]) {
        const env = lambdaEnvironment(template, name);
        for (const secret of SECRET_ENV_VARS) expect(env).not.toHaveProperty(secret);
      }
      const jobsEnv = (jobsContainer(template).Environment as any[]).map((e) => e.Name);
      for (const secret of SECRET_ENV_VARS) expect(jobsEnv).not.toContain(secret);
    });
  }

  test('the web server and recommender get the SSM prefix and their exact secret lists', () => {
    const withoutR2 = buildTemplate('', { secretsFromSsm: true });
    expect(environmentOptionNames(withoutR2, 'cubecobra-production-v2-env')).toMatchObject({
      SSM_SECRETS_PREFIX: '/cubecobra/prod/secrets/',
      SSM_SECRET_NAMES: WEB_SERVER_SECRET_NAMES,
    });
    expect(environmentOptionNames(withoutR2, 'cubecobra-recommender-production-v2-env')).toMatchObject({
      SSM_SECRETS_PREFIX: '/cubecobra/prod/secrets/',
      SSM_SECRET_NAMES: 'RECOMMENDER_SHARED_SECRET?,RECOMMENDER_SHARED_SECRET_PREVIOUS?',
    });

    const withR2 = buildTemplate('', { secretsFromSsm: true, r2: true });
    const env = environmentOptionNames(withR2, 'cubecobra-production-v2-env');
    expect(env).toMatchObject({
      SSM_SECRET_NAMES: `${WEB_SERVER_SECRET_NAMES},R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY`,
      // Non-secret settings stay plain environment variables.
      R2_ENDPOINT: 'https://r2.example.com',
      R2_BUCKET: 'r2-bucket',
      PATREON_CLIENT_ID: 'patreon-client-id',
      CAPTCHA_SITE_KEY: 'captcha-site-key',
      GA_MEASUREMENT_ID: 'ga-measurement-id',
      STRIPE_PUBLIC_KEY: 'stripe-public-key',
    });
  });

  test('the lambdas get only the secrets their code reads', () => {
    const template = buildTemplate('', { secretsFromSsm: true });
    expect(lambdaEnvironment(template, 'DailyJobsLambda-example-production')).toMatchObject({
      SSM_SECRETS_PREFIX: '/cubecobra/prod/secrets/',
      SSM_SECRET_NAMES: 'MANAMATRIX_API_KEY',
    });
    const botEnv = lambdaEnvironment(template, 'BotDeckbuild-example-production');
    expect(botEnv).toMatchObject({
      SSM_SECRETS_PREFIX: '/cubecobra/prod/secrets/',
      SSM_SECRET_NAMES: 'RECOMMENDER_SHARED_SECRET?',
    });
    // The in-VPC lambda has no internet route, so it reaches SSM through its own interface endpoint.
    expect(botEnv).toHaveProperty('AWS_ENDPOINT_URL_SSM');
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      VpcEndpointType: 'Interface',
      ServiceName: 'com.amazonaws.us-east-2.ssm',
      PrivateDnsEnabled: false,
    });
    const monitorEnv = lambdaEnvironment(template, 'CardUpdateMonitor-example-production');
    expect(monitorEnv).not.toHaveProperty('SSM_SECRETS_PREFIX');
    expect(monitorEnv).not.toHaveProperty('SSM_SECRET_NAMES');
  });

  test('IAM: the instance role reads the stage secrets path, each lambda only its own parameters', () => {
    const template = buildTemplate('', { secretsFromSsm: true });

    expect(ssmStatements(template, 'InstanceRole')).toEqual([
      expect.objectContaining({ Action: 'ssm:GetParameters', Resource: `${PARAM}*` }),
    ]);
    expect(ssmStatements(template, 'DailyJobsLambda')).toEqual([
      expect.objectContaining({ Action: 'ssm:GetParameters', Resource: `${PARAM}MANAMATRIX_API_KEY` }),
    ]);
    expect(ssmStatements(template, 'BotDeckbuildLambda')).toEqual([
      expect.objectContaining({ Action: 'ssm:GetParameters', Resource: `${PARAM}RECOMMENDER_SHARED_SECRET` }),
    ]);
    expect(ssmStatements(template, 'CardUpdateMonitorLambda')).toEqual([]);
    // No kms grants are needed for the AWS-managed aws/ssm key.
    const allActions = Object.values(template.findResources('AWS::IAM::Policy')).flatMap((p: any) =>
      p.Properties.PolicyDocument.Statement.flatMap((s: any) => [s.Action].flat()),
    );
    expect(allActions.filter((a: string) => a.startsWith('kms:'))).toEqual([]);
  });

  test('the jobs task gets the R2 keys as ECS secrets, readable by its execution role only', () => {
    const template = buildTemplate('', { secretsFromSsm: true, r2: true });
    const container = jobsContainer(template);
    const r2Arn = (name: string) => ({
      'Fn::Join': [
        '',
        ['arn:', { Ref: 'AWS::Partition' }, `:ssm:us-east-2:123456789012:parameter/cubecobra/prod/secrets/${name}`],
      ],
    });
    expect(container.Secrets).toEqual([
      { Name: 'R2_ACCESS_KEY_ID', ValueFrom: r2Arn('R2_ACCESS_KEY_ID') },
      { Name: 'R2_SECRET_ACCESS_KEY', ValueFrom: r2Arn('R2_SECRET_ACCESS_KEY') },
    ]);
    const env = Object.fromEntries((container.Environment as any[]).map((e) => [e.Name, e.Value]));
    expect(env).toMatchObject({ R2_ENDPOINT: 'https://r2.example.com', R2_BUCKET: 'r2-bucket' });

    const executionRoleSsm = ssmStatements(template, 'JobsTaskTaskExecutionRole');
    expect(executionRoleSsm.flatMap((s) => [s.Resource].flat())).toEqual([
      r2Arn('R2_ACCESS_KEY_ID'),
      r2Arn('R2_SECRET_ACCESS_KEY'),
    ]);
    expect(ssmStatements(template, 'JobsTaskTaskRole')).toEqual([]);

    // Without R2 there is nothing to inject.
    expect(jobsContainer(buildTemplate('', { secretsFromSsm: true })).Secrets).toBeUndefined();
  });
});

describe('without secretsFromSsm', () => {
  test('secret values are still synthesized as before, minus the unused SESSION_SECRET and JOBS_TOKEN', () => {
    const template = buildTemplate('shared-secret', { r2: true });
    const env = environmentOptionNames(template, 'cubecobra-production-v2-env');
    expect(env).toMatchObject({
      SESSION: SECRET_VALUES.sessionToken,
      PATREON_CLIENT_SECRET: SECRET_VALUES.patreonClientSecret,
      CAPTCHA_SECRET_KEY: SECRET_VALUES.captchaSecretKey,
      DRAFTMANCER_API_KEY: SECRET_VALUES.draftmancerApiKey,
      MANAMATRIX_API_KEY: SECRET_VALUES.manaMatrixApiKey,
      R2_ACCESS_KEY_ID: SECRET_VALUES.r2AccessKeyId,
      RECOMMENDER_SHARED_SECRET: 'shared-secret',
    });
    expect(env).not.toHaveProperty('SESSION_SECRET');
    expect(env).not.toHaveProperty('JOBS_TOKEN');
    expect(env).not.toHaveProperty('SSM_SECRETS_PREFIX');
    expect(lambdaEnvironment(template, 'DailyJobsLambda-example-production')).toMatchObject({
      MANAMATRIX_API_KEY: SECRET_VALUES.manaMatrixApiKey,
    });
    expect(jobsContainer(template).Secrets).toBeUndefined();
    expect(ssmStatements(template, 'InstanceRole')).toEqual([]);
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 0);
  });

  test('the lambdas no longer receive API keys their code does not read', () => {
    const template = buildTemplate('shared-secret');
    const monitorEnv = lambdaEnvironment(template, 'CardUpdateMonitor-example-production');
    const dailyEnv = lambdaEnvironment(template, 'DailyJobsLambda-example-production');
    const botEnv = lambdaEnvironment(template, 'BotDeckbuild-example-production');
    for (const env of [monitorEnv, dailyEnv, botEnv]) expect(env).not.toHaveProperty('DRAFTMANCER_API_KEY');
    expect(monitorEnv).not.toHaveProperty('MANAMATRIX_API_KEY');
    expect(botEnv).not.toHaveProperty('MANAMATRIX_API_KEY');
  });
});

// ---------------------------------------------------------------------------------------------
// ML retraining pipeline
// ---------------------------------------------------------------------------------------------

// The state machine definition as JSON, with every CloudFormation token replaced by 'TOKEN'.
const stateMachineStates = (template: Template): Record<string, any> => {
  const machine: any = Object.values(template.findResources('AWS::StepFunctions::StateMachine'))[0];
  const definition = machine.Properties.DefinitionString;
  const text =
    typeof definition === 'string'
      ? definition
      : definition['Fn::Join'][1].map((part: unknown) => (typeof part === 'string' ? part : 'TOKEN')).join('');
  return JSON.parse(text).States;
};

const taskDefinition = (template: Template, family: string): any =>
  (Object.values(template.findResources('AWS::ECS::TaskDefinition')) as any[]).find(
    (definition) => definition.Properties.Family === family,
  ).Properties;

const containerEnvironment = (container: any): Record<string, string> =>
  Object.fromEntries((container.Environment as any[]).map((e) => [e.Name, e.Value]));

describe('ML pipeline', () => {
  test('is only created when configured', () => {
    const template = buildTemplate('');
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 0);
    expect(environmentOptionNames(template, 'cubecobra-production-v2-env')).not.toHaveProperty(
      'ML_PIPELINE_STATE_MACHINE_ARN',
    );
  });

  test('trains on the GPU capacity provider and runs the CPU stages on Fargate', () => {
    const states = stateMachineStates(buildTemplate('', { mlPipeline: true }));

    for (const name of ['Train', 'Package']) {
      expect(states[name].Resource).toMatch(/ecs:runTask\.sync$/);
      // Managed scaling only provisions from zero for tasks naming the capacity provider.
      expect(states[name].Parameters.CapacityProviderStrategy).toEqual([{ CapacityProvider: 'TOKEN', Weight: 1 }]);
      expect(states[name].Parameters).not.toHaveProperty('LaunchType');
      expect(states[name].Retry[0]).toMatchObject({
        ErrorEquals: ['ECS.AmazonECSException'],
        IntervalSeconds: 600,
        MaxAttempts: 6,
      });
    }
    expect(states.Train.TimeoutSeconds).toBe(72 * 3600);
    expect(states.Train.Retry[1]).toMatchObject({ ErrorEquals: ['States.TaskFailed'], MaxAttempts: 3 });
    expect(states.Train.Parameters.Overrides.ContainerOverrides).toEqual([
      {
        Name: 'MlGpuContainer',
        Command: ['python', '-m', 'ccml.train'],
        Environment: [{ Name: 'ML_RUN_ID', 'Value.$': '$.run.runId' }],
      },
    ]);

    for (const [name, script, hours] of [
      ['ProcessData', 'ml-process-data', 3],
      ['Evaluate', 'ml-evaluate', 3],
      ['Archetypes', 'ml-archetypes', 2],
      ['Publish', 'ml-publish', 1],
    ] as const) {
      expect(states[name].Parameters.LaunchType).toBe('FARGATE');
      expect(states[name].Parameters.Overrides.ContainerOverrides[0].Command).toEqual(['npm', 'run', script]);
      expect(states[name].TimeoutSeconds).toBe(hours * 3600);
    }
  });

  test('every task fails into RecordFailure, and approval waits up to 7 days for a task token', () => {
    const states = stateMachineStates(buildTemplate('', { mlPipeline: true }));

    const tasks = Object.entries(states).filter(([, state]) => state.Type === 'Task');
    expect(tasks.length).toBeGreaterThan(20);
    const expectedNext = (name: string): string => {
      // Before Prepare there is no run to mark failed.
      if (name === 'Prepare' || name === 'RecordFailure') return 'Failed';
      // Once the pointer may have moved, the promotion is reverted first.
      const promotion = name.match(/^(?:Promote|Verify)(Beta|Production)$/);
      return promotion ? `Revert${promotion[1]}` : 'RecordFailure';
    };
    for (const [name, state] of tasks) {
      expect(state.Catch).toEqual([expect.objectContaining({ ErrorEquals: ['States.ALL'], Next: expectedNext(name) })]);
    }

    expect(states.AwaitApproval.Resource).toMatch(/lambda:invoke\.waitForTaskToken$/);
    expect(states.AwaitApproval.TimeoutSeconds).toBe(7 * 24 * 3600);
    expect(states.AwaitApproval.Parameters.Payload['taskToken.$']).toBe('$$.Task.Token');
    expect(states.GatePassed.Default).toBe('GateFailed');
    expect(states.Mode.Choices[0].Next).toBe('StepPromotingProduction');
  });

  test('a promotion that never serves the new version is reverted, then recorded as failed', () => {
    const states = stateMachineStates(buildTemplate('', { mlPipeline: true }));
    for (const name of ['Beta', 'Production']) {
      // No restart: the recommenders hot-reload the pointer within a minute.
      expect(states[`Promote${name}`].Next).toBe(`Wait${name}Reload`);
      expect(states[`Wait${name}Reload`].Seconds).toBe(60);
      expect(states[`Wait${name}Again`].Seconds).toBe(60);
      expect(states[`${name}Serving`].Choices[1]).toMatchObject({ NumericGreaterThanEquals: 20 });
      expect(states[`${name}NotServing`].Next).toBe(`Revert${name}`);

      const revert = states[`Revert${name}`];
      // Direct Lambda integration (payloadResponseOnly): Parameters is the payload itself.
      expect(revert.Parameters).toMatchObject({
        action: 'revert',
        target: name.toLowerCase(),
        'runId.$': '$.run.runId',
        'version.$': '$.run.version',
      });
      // A failing revert must not keep the run from being recorded.
      expect(revert.Next).toBe('RecordFailure');
      expect(revert.Catch).toEqual([
        { ErrorEquals: ['States.ALL'], ResultPath: '$.revertError', Next: 'RecordFailure' },
      ]);
    }
  });

  test('the server and the export job can start runs; the ML tasks get their own settings', () => {
    const template = buildTemplate('', { mlPipeline: true, r2: true });

    expect(environmentOptionNames(template, 'cubecobra-production-v2-env')).toHaveProperty(
      'ML_PIPELINE_STATE_MACHINE_ARN',
    );
    const serverActions = policyStatements(template, 'InstanceRole').flatMap((s) => [s.Action].flat());
    expect(serverActions).toEqual(
      expect.arrayContaining([
        'states:StartExecution',
        'states:DescribeExecution',
        'states:StopExecution',
        'states:SendTaskSuccess',
        'states:SendTaskFailure',
      ]),
    );

    const jobs = taskDefinition(template, 'cubecobra-jobs-production').ContainerDefinitions[0];
    expect(containerEnvironment(jobs)).toHaveProperty('ML_PIPELINE_STATE_MACHINE_ARN');
    const jobsActions = policyStatements(template, 'JobsTaskTaskRole').flatMap((s) => [s.Action].flat());
    expect(jobsActions).toContain('states:StartExecution');
    expect(jobsActions).not.toContain('states:SendTaskSuccess');

    const cpu = taskDefinition(template, 'cubecobra-ml-cpu-production');
    expect(cpu).toMatchObject({ Cpu: '8192', Memory: '32768', EphemeralStorage: { SizeInGiB: 200 } });
    const cpuEnv = containerEnvironment(cpu.ContainerDefinitions[0]);
    expect(cpuEnv).toMatchObject({
      ML_RUNS_BUCKET: 'test-data-bucket',
      ML_EXPORT_BUCKET: 'test-public-bucket',
      ML_LIVE_BUCKET: 'test-data-bucket',
      ML_PUBLISH_BUCKETS: 'test-beta-bucket,test-data-bucket',
      ML_R2_TARGETS: 'production,beta',
      DATA_BUCKET: 'test-data-bucket',
    });
    expect(cpuEnv).not.toHaveProperty('ML_PIPELINE_STATE_MACHINE_ARN');
    expect(cpuEnv).not.toHaveProperty('R2_ACCESS_KEY_ID');
    expect(cpuEnv).not.toHaveProperty('R2_SECRET_ACCESS_KEY');
    const secrets = cpu.ContainerDefinitions[0].Secrets as any[];
    expect(secrets.map((secret) => secret.Name).sort()).toEqual(
      ['BETA', 'PRODUCTION']
        .flatMap((target) =>
          ['ENDPOINT', 'BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY'].map((suffix) => `ML_R2_${target}_${suffix}`),
        )
        .sort(),
    );
    expect(JSON.stringify(secrets)).toContain('parameter/cubecobra/beta/r2-secret-access-key');
    expect(JSON.stringify(secrets)).toContain('parameter/cubecobra/prod/r2-endpoint');

    const gpu = taskDefinition(template, 'cubecobra-ml-gpu-production');
    expect(gpu).toMatchObject({ RequiresCompatibilities: ['EC2'], NetworkMode: 'bridge' });
    expect(gpu.ContainerDefinitions[0]).toMatchObject({
      MemoryReservation: 30720,
      ResourceRequirements: [{ Type: 'GPU', Value: '1' }],
    });
    expect(containerEnvironment(gpu.ContainerDefinitions[0])).toMatchObject({ ML_RUNS_BUCKET: 'test-data-bucket' });
  });

  test('GPU capacity scales from zero on the AL2023 GPU AMI, preferring g5 over g6', () => {
    const template = buildTemplate('', { mlPipeline: true });
    expect(JSON.stringify(template.toJSON().Parameters)).toContain(
      '/aws/service/ecs/optimized-ami/amazon-linux-2023/gpu/recommended/image_id',
    );
    template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
      MinSize: '0',
      MaxSize: '1',
      MixedInstancesPolicy: Match.objectLike({
        InstancesDistribution: Match.objectLike({
          OnDemandAllocationStrategy: 'prioritized',
          OnDemandPercentageAboveBaseCapacity: 100,
        }),
        LaunchTemplate: Match.objectLike({
          Overrides: [{ InstanceType: 'g5.2xlarge' }, { InstanceType: 'g6.2xlarge' }],
        }),
      }),
    });
    template.hasResourceProperties('AWS::ECS::CapacityProvider', {
      AutoScalingGroupProvider: Match.objectLike({
        ManagedScaling: Match.objectLike({ Status: 'ENABLED', TargetCapacity: 100 }),
        ManagedTerminationProtection: 'DISABLED',
      }),
    });
    template.hasResourceProperties('AWS::EC2::LaunchTemplate', {
      LaunchTemplateData: Match.objectLike({
        BlockDeviceMappings: [
          { DeviceName: '/dev/xvda', Ebs: Match.objectLike({ VolumeSize: 200, VolumeType: 'gp3' }) },
        ],
        MetadataOptions: Match.objectLike({ HttpTokens: 'required' }),
      }),
    });
  });

  test('one bundle runs as a pipeline function outside the VPC and a verify function inside it', () => {
    const template = buildTemplate('', { mlPipeline: true });
    const functions = Object.values(template.findResources('AWS::Lambda::Function')) as any[];
    const byName = (name: string) => functions.find((f) => f.Properties.FunctionName === name).Properties;

    const pipeline = byName('MlPipeline-example-production');
    const verify = byName('MlPipelineVerify-example-production');
    expect(pipeline.VpcConfig).toBeUndefined();
    expect(verify.VpcConfig).toBeDefined();
    for (const fn of [pipeline, verify]) {
      expect(fn.Code.S3Key).toBe('mlPipelineLambda/v1.0.0.zip');
      expect(fn.Environment.Variables).toMatchObject({
        ML_RUNS_BUCKET: 'test-data-bucket',
        ML_PROMOTE_TARGETS: JSON.stringify(ML_PIPELINE.promoteTargets),
      });
      expect(fn.Environment.Variables).toHaveProperty('DYNAMO_TABLE');
    }

    const actions = policyStatements(template, 'MlPipelinePipelineFunctionRole').flatMap((s) => [s.Action].flat());
    expect(actions).toEqual(expect.arrayContaining(['elasticbeanstalk:DescribeEnvironments', 'dynamodb:UpdateItem']));
    // Promotion only moves the pointer; the recommenders hot-reload it.
    expect(actions.filter((a: string) => a.startsWith('elasticbeanstalk:'))).toEqual([
      'elasticbeanstalk:DescribeEnvironments',
    ]);
    for (const prefix of ['autoscaling:', 'ec2:', 'cloudformation:']) {
      expect(actions.filter((a: string) => a.startsWith(prefix))).toEqual([]);
    }
    expect(policyStatements(template, 'MlPipelineVerifyFunctionRole')).toEqual([]);
  });
});
