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

  expect(prod.artifacts).toBeUndefined();

  expect(allCommands(beta)).toContain(
    'export JOBS_ECR_REPO=$(aws cloudformation describe-stacks --stack-name CubeCobraBetaStack --query "Stacks[0].Outputs[?contains(OutputKey, \\`JobsEcr\\`) && contains(OutputKey, \\`RepositoryUri\\`)].OutputValue | [0]" --output text)',
  );
  expect(allCommands(prod)).toContain(
    'npx cdk deploy CubeCobraProdStack --require-approval never --context environment=production --context version=$CODEBUILD_RESOLVED_SOURCE_VERSION',
  );
});

test('No CodeBuild role statement grants broad actions on Resource *', () => {
  const statements = policyStatements(buildTemplate());
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
