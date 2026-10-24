import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { DeploymentPipeline } from '../lib/deployment-pipeline';
import { BaseTestStack } from './base-test-stack';

const ACCOUNT = '123456789012';

const buildTemplate = (secretsFromSsm: { beta?: boolean; production?: boolean } = {}): Template => {
  const app = new cdk.App();
  const stack = new BaseTestStack(app, 'TestStack');
  new DeploymentPipeline(stack, 'DeploymentPipeline', {
    githubOwner: 'my-org',
    githubRepo: 'my-repo',
    githubBranch: 'master',
    codestarConnectionArn: `arn:aws:codeconnections:us-east-1:${ACCOUNT}:connection/mock`,
    betaDomain: 'beta.example.com',
    productionDomain: 'example.com',
    account: ACCOUNT,
    region: 'us-east-1',
    betaStackName: 'CubeCobraBetaStack',
    productionStackName: 'CubeCobraProdStack',
    appBucket: 'cubecobra',
    betaSecretsFromSsm: secretsFromSsm.beta ?? false,
    productionSecretsFromSsm: secretsFromSsm.production ?? false,
  });
  return Template.fromStack(stack);
};

const buildSpecs = (template: Template): { name: string; spec: any }[] =>
  Object.values(template.findResources('AWS::CodeBuild::Project')).map((project: any) => ({
    name: project.Properties.Name,
    spec: JSON.parse(project.Properties.Source.BuildSpec),
  }));

const allCommands = (spec: any): string[] =>
  Object.values(spec.phases).flatMap((phase: any) => (phase.commands as string[] | undefined) ?? []);

const policyStatements = (template: Template): any[] =>
  Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (policy: any) => policy.Properties.PolicyDocument.Statement,
  );

const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

test('Every CodeBuild project installs from the lockfile with npm ci', () => {
  const specs = buildSpecs(buildTemplate());
  expect(specs.map((s) => s.name).sort()).toEqual([
    'CubeCobra-Deploy-Beta',
    'CubeCobra-Deploy-Production',
    'CubeCobra-Integration-Tests',
  ]);
  for (const { spec } of specs) {
    const commands = allCommands(spec);
    expect(commands).toContain('npm ci');
    expect(commands.filter((c) => /\bnpm install\b/.test(c))).toEqual([]);
  }
});

test('Deploy buildspecs keep the exact jobs ECR lookup command and drop the beta **/* artifact export', () => {
  const specs = buildSpecs(buildTemplate());
  const beta = specs.find((s) => s.name === 'CubeCobra-Deploy-Beta')!.spec;
  const prod = specs.find((s) => s.name === 'CubeCobra-Deploy-Production')!.spec;

  expect(beta.artifacts).toBeUndefined();
  expect(prod.artifacts).toBeUndefined();

  expect(allCommands(beta)).toContain(
    'export JOBS_ECR_REPO=$(aws cloudformation describe-stacks --stack-name CubeCobraBetaStack --query "Stacks[0].Outputs[?contains(OutputKey, \\`JobsEcr\\`) && contains(OutputKey, \\`RepositoryUri\\`)].OutputValue | [0]" --output text)',
  );
  expect(allCommands(prod)).toContain(
    'npx cdk deploy CubeCobraProdStack --require-approval never --context environment=production --context version=$CODEBUILD_RESOLVED_SOURCE_VERSION',
  );
});

test('The recommender shared secret is read from SSM right before cdk deploy, tolerating a missing parameter', () => {
  const specs = buildSpecs(buildTemplate());
  for (const [name, stage] of [
    ['CubeCobra-Deploy-Beta', 'beta'],
    ['CubeCobra-Deploy-Production', 'prod'],
  ]) {
    const spec = specs.find((s) => s.name === name)!.spec;
    const preBuild: string[] = spec.phases.pre_build.commands;
    const build: string[] = spec.phases.build.commands;
    const fetchIndex = build.findIndex((c) => c.includes(`/cubecobra/${stage}/recommender-shared-secret`));
    const deployIndex = build.findIndex((c) => c.startsWith('npx cdk deploy'));
    expect(fetchIndex).toBeGreaterThanOrEqual(0);
    expect(fetchIndex).toBeLessThan(deployIndex);
    expect(build[fetchIndex]).toContain('grep -q ParameterNotFound');
    expect(build[fetchIndex]).toContain('export RECOMMENDER_SHARED_SECRET');
    // Never during npm ci / package builds.
    expect(preBuild.some((c) => c.includes('recommender-shared-secret'))).toBe(false);
    // Not a PARAMETER_STORE variable: CodeBuild would refuse to start while the parameter is missing.
    expect(JSON.stringify(spec)).not.toContain('parameter-store');
  }
});

test('No CodeBuild role statement grants broad actions on Resource *', () => {
  const statements = policyStatements(buildTemplate());
  const wildcardStatements = statements.filter((s) => asArray(s.Resource).includes('*'));
  const wildcardActions = wildcardStatements.flatMap((s) => asArray(s.Action));
  // ecr:GetAuthorizationToken has no resource-level permissions.
  for (const action of wildcardActions) {
    expect(['ecr:GetAuthorizationToken']).toContain(action);
  }

  const allActions = statements.flatMap((s) => asArray(s.Action));
  for (const forbidden of [
    'iam:PassRole',
    'cloudformation:*',
    'ec2:*',
    'elasticbeanstalk:*',
    's3:*',
    'acm:*',
    'cloudfront:*',
    'route53:*',
    'ecr:*',
    'ecr-public:*',
  ]) {
    expect(allActions).not.toContain(forbidden);
  }
});

test('sts:AssumeRole is limited to the CDK bootstrap roles', () => {
  // CodePipeline's own action-role AssumeRole statements reference the roles by Fn::GetAtt.
  const statements = policyStatements(buildTemplate()).filter(
    (s) => asArray(s.Action).includes('sts:AssumeRole') && asArray(s.Resource).every((r) => typeof r === 'string'),
  );
  // One per deploy project.
  expect(statements).toHaveLength(2);
  for (const statement of statements) {
    expect(asArray(statement.Resource).sort()).toEqual(
      [
        `arn:aws:iam::${ACCOUNT}:role/cdk-hnb659fds-deploy-role-${ACCOUNT}-*`,
        `arn:aws:iam::${ACCOUNT}:role/cdk-hnb659fds-file-publishing-role-${ACCOUNT}-*`,
        `arn:aws:iam::${ACCOUNT}:role/cdk-hnb659fds-image-publishing-role-${ACCOUNT}-*`,
        `arn:aws:iam::${ACCOUNT}:role/cdk-hnb659fds-lookup-role-${ACCOUNT}-*`,
      ].sort(),
    );
  }
});

test('Bundle uploads are limited to the publish prefixes of the app bucket', () => {
  const template = buildTemplate();
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: ['s3:PutObject', 's3:AbortMultipartUpload'],
          Resource: [
            'arn:aws:s3:::cubecobra/builds/*',
            'arn:aws:s3:::cubecobra/dailyJobsLambda/*',
            'arn:aws:s3:::cubecobra/cardUpdateMonitorLambda/*',
            'arn:aws:s3:::cubecobra/botDeckbuildLambda/*',
          ],
        }),
        Match.objectLike({
          Action: 'cloudformation:DescribeStacks',
          Resource: `arn:aws:cloudformation:us-east-1:${ACCOUNT}:stack/CubeCobraBetaStack/*`,
        }),
      ]),
    },
  });
});

test('Pipeline artifact bucket is versioned and denies non-TLS access', () => {
  const template = buildTemplate();
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketName: `cubecobra-pipeline-artifacts-${ACCOUNT}`,
    VersioningConfiguration: { Status: 'Enabled' },
  });
  template.hasResourceProperties('AWS::S3::BucketPolicy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Effect: 'Deny',
          Action: 's3:*',
          Condition: { Bool: { 'aws:SecureTransport': 'false' } },
        }),
      ]),
    },
  });
});

test('The beta deploy action no longer exports an output artifact', () => {
  const template = buildTemplate();
  const pipeline: any = Object.values(template.findResources('AWS::CodePipeline::Pipeline'))[0];
  const betaStage = pipeline.Properties.Stages.find((s: any) => s.Name === 'DeployBeta');
  expect(betaStage.Actions[0].OutputArtifacts).toBeUndefined();
});

// ---------------------------------------------------------------------------------------------
// Build environment and Parameter Store access per stage
// ---------------------------------------------------------------------------------------------

const projectEnvironment = (template: Template, name: string): any[] =>
  (Object.values(template.findResources('AWS::CodeBuild::Project')) as any[]).find((p) => p.Properties.Name === name)
    .Properties.Environment.EnvironmentVariables;

const SECRET_BUILD_VARS = [
  'STRIPE_SECRET_KEY',
  'SESSION_TOKEN',
  'PATREON_CLIENT_SECRET',
  'PATREON_HOOK_SECRET',
  'CAPTCHA_SECRET_KEY',
  'GA_API_SECRET',
  'DRAFTMANCER_API_KEY',
  'MANAMATRIX_API_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];

// The explicit Parameter Store grant of a deploy project (CDK adds its own GetParameters statement
// for the PARAMETER_STORE variables; that one is a subset of this).
const parameterReadResources = (template: Template, stage: 'Beta' | 'Prod'): string[] => {
  const policy: any = Object.entries(template.findResources('AWS::IAM::Policy')).find(([id]) =>
    id.startsWith(`DeploymentPipeline${stage}DeployProjectRole`),
  )![1];
  const statement = policy.Properties.PolicyDocument.Statement.find(
    (s: any) => JSON.stringify(s.Action) === JSON.stringify(['ssm:GetParameter', 'ssm:GetParameters']),
  );
  return [statement.Resource].flat();
};

test('SESSION_SECRET and JOBS_TOKEN are no longer passed to any build', () => {
  for (const template of [buildTemplate(), buildTemplate({ beta: true, production: true })]) {
    for (const name of ['CubeCobra-Deploy-Beta', 'CubeCobra-Deploy-Production']) {
      const names = projectEnvironment(template, name).map((v) => v.Name);
      expect(names).not.toContain('SESSION_SECRET');
      expect(names).not.toContain('JOBS_TOKEN');
    }
  }
});

test('Without secretsFromSsm the stages keep their secrets and the /cubecobra/<stage>/* read grant', () => {
  const template = buildTemplate();
  const beta = projectEnvironment(template, 'CubeCobra-Deploy-Beta').map((v) => v.Name);
  const prod = projectEnvironment(template, 'CubeCobra-Deploy-Production').map((v) => v.Name);
  expect(beta).toEqual(expect.arrayContaining(SECRET_BUILD_VARS.filter((v) => v !== 'GA_API_SECRET')));
  expect(beta).not.toContain('GA_MEASUREMENT_ID');
  expect(prod).toEqual(expect.arrayContaining([...SECRET_BUILD_VARS, 'GA_MEASUREMENT_ID']));
  expect(parameterReadResources(template, 'Beta')).toEqual([
    `arn:aws:ssm:us-east-1:${ACCOUNT}:parameter/cubecobra/beta/*`,
  ]);
  expect(parameterReadResources(template, 'Prod')).toEqual([
    `arn:aws:ssm:us-east-1:${ACCOUNT}:parameter/cubecobra/prod/*`,
  ]);
});

test('A flagged stage gets no secrets in its build environment and cannot read /secrets/', () => {
  // Only production flagged: beta must be unaffected.
  const template = buildTemplate({ production: true });

  const prodVars = projectEnvironment(template, 'CubeCobra-Deploy-Production');
  expect(prodVars.map((v) => v.Name)).toEqual([
    'AWS_ACCOUNT_ID',
    'AWS_DEFAULT_REGION',
    'STRIPE_PUBLIC_KEY',
    'PATREON_CLIENT_ID',
    'CAPTCHA_SITE_KEY',
    'GA_MEASUREMENT_ID',
    'R2_ENDPOINT',
    'R2_BUCKET',
    'CARD_IMAGE_BASE_URL',
  ]);
  const parameter = (name: string) => `arn:aws:ssm:us-east-1:${ACCOUNT}:parameter/cubecobra/prod/${name}`;
  expect(parameterReadResources(template, 'Prod')).toEqual(
    [
      'stripe-public-key',
      'patreon-client-id',
      'captcha-site-key',
      'ga-measurement-id',
      'r2-endpoint',
      'r2-bucket',
      'card-image-base-url',
      // read by the asset-upload step only (not exported to the build environment)
      'r2-access-key-id',
      'r2-secret-access-key',
    ].map(parameter),
  );
  for (const resource of parameterReadResources(template, 'Prod')) {
    expect(resource).not.toContain('/secrets/');
    expect(resource).not.toContain('*');
  }

  const prod = buildSpecs(template).find((s) => s.name === 'CubeCobra-Deploy-Production')!.spec;
  const build: string[] = prod.phases.build.commands;
  expect(allCommands(prod).some((c) => c.includes('recommender-shared-secret'))).toBe(false);
  // The R2 upload credentials are fetched inside a subshell that only runs the asset upload.
  const upload = build.find((c) => c.includes('upload-assets'))!;
  expect(upload).toMatch(/^\( .*npm run upload-assets --workspace=packages\/scripts \)$/);
  expect(upload).toContain('--name /cubecobra/prod/r2-access-key-id');
  expect(upload).toContain('--name /cubecobra/prod/r2-secret-access-key');
  expect(allCommands(prod).filter((c) => c.includes('r2-access-key-id'))).toEqual([upload]);

  // Beta (not flagged) is unchanged.
  const betaNames = projectEnvironment(template, 'CubeCobra-Deploy-Beta').map((v) => v.Name);
  expect(betaNames).toEqual(expect.arrayContaining(SECRET_BUILD_VARS.filter((v) => v !== 'GA_API_SECRET')));
  const beta = buildSpecs(template).find((s) => s.name === 'CubeCobra-Deploy-Beta')!.spec;
  expect(beta.phases.build.commands).toContain('npm run upload-assets --workspace=packages/scripts');
  expect(allCommands(beta).some((c) => c.includes('/cubecobra/beta/recommender-shared-secret'))).toBe(true);
});
