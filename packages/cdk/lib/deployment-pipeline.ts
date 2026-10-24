import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { ssmSegmentFor } from './secrets';

export interface DeploymentPipelineProps {
  /**
   * GitHub repository owner/organization
   */
  githubOwner: string;

  /**
   * GitHub repository name
   */
  githubRepo: string;

  /**
   * GitHub branch to trigger pipeline
   */
  githubBranch: string;

  /**
   * CodeStar Connection ARN for GitHub
   * Create this manually in AWS Console: Developer Tools > Connections
   */
  codestarConnectionArn: string;

  /**
   * Beta environment domain
   */
  betaDomain: string;

  /**
   * Production environment domain
   */
  productionDomain: string;

  /**
   * AWS account ID
   */
  account: string;

  /**
   * AWS region
   */
  region: string;

  /**
   * CloudFormation stack names deployed by the beta / production projects (config.ts stackName)
   */
  betaStackName: string;
  productionStackName: string;

  /**
   * S3 bucket the build bundles (server, recommender, lambdas) are published to (config.ts appBucket)
   */
  appBucket: string;

  /**
   * config.ts secretsFromSsm per stage: when true the stage's services load their secrets from SSM at
   * runtime, so its deploy project gets no application secrets and can't read /cubecobra/<segment>/secrets/.
   */
  betaSecretsFromSsm: boolean;
  productionSecretsFromSsm: boolean;
}

// Key prefixes in the app bucket that the deploy projects write build bundles to:
// packages/scripts/src/publish.ts (builds/<version>.zip), packages/recommenderService/publish.js
// (builds/recommender-<version>.zip) and the three lambda publish.js scripts (<lambda>/<version>.zip).
const APP_BUCKET_PUBLISH_PREFIXES = ['builds', 'dailyJobsLambda', 'cardUpdateMonitorLambda', 'botDeckbuildLambda'];

// Bootstrap roles `cdk deploy` assumes. The account is bootstrapped with the default qualifier
// (cdk.json sets no @aws-cdk/core:bootstrapQualifier; the synthesized manifest references
// /cdk-bootstrap/hnb659fds/version). The cfn-exec role is deliberately absent: only
// CloudFormation can assume it, and the deploy role passes it.
const CDK_BOOTSTRAP_ROLE_KINDS = ['deploy', 'file-publishing', 'image-publishing', 'lookup'];

/**
 * Builds the shell command that exports RECOMMENDER_SHARED_SECRET from SSM for `cdk deploy` (infra.ts reads it).
 *
 * This deliberately isn't a PARAMETER_STORE environment variable like the other secrets: CodeBuild refuses to
 * start a build when such a parameter is missing, and this one is optional (empty = recommender auth disabled).
 * A missing parameter yields an empty value; any other SSM error fails the build instead of silently deploying
 * with auth disabled. It is fetched right before `cdk deploy`, after `npm ci` and the package build scripts have
 * run, so third-party install/build code never sees it.
 */
const exportRecommenderSharedSecret = (parameterName: string): string =>
  `{ RECOMMENDER_SHARED_SECRET="$(aws ssm get-parameter --name ${parameterName} --with-decryption --query Parameter.Value --output text 2>/tmp/recommender-shared-secret.err)" || grep -q ParameterNotFound /tmp/recommender-shared-secret.err; } && export RECOMMENDER_SHARED_SECRET`;

interface BuildParameter {
  /** Environment variable `cdk deploy` (app/infra.ts) reads */
  envVar: string;
  /** Parameter name under /cubecobra/<segment>/ */
  parameter: string;
  /** Left out of the build environment for stages with secretsFromSsm */
  secret: boolean;
  /** Only provisioned for production */
  productionOnly?: boolean;
}

// PARAMETER_STORE values exposed to the deploy projects, in build-environment order.
const BUILD_PARAMETERS: BuildParameter[] = [
  { envVar: 'STRIPE_SECRET_KEY', parameter: 'stripe-secret-key', secret: true },
  { envVar: 'STRIPE_PUBLIC_KEY', parameter: 'stripe-public-key', secret: false },
  { envVar: 'SESSION_TOKEN', parameter: 'session-token', secret: true },
  { envVar: 'PATREON_CLIENT_ID', parameter: 'patreon-client-id', secret: false },
  { envVar: 'PATREON_CLIENT_SECRET', parameter: 'patreon-client-secret', secret: true },
  { envVar: 'PATREON_HOOK_SECRET', parameter: 'patreon-hook-secret', secret: true },
  { envVar: 'CAPTCHA_SITE_KEY', parameter: 'captcha-site-key', secret: false },
  { envVar: 'CAPTCHA_SECRET_KEY', parameter: 'captcha-secret-key', secret: true },
  // Google Analytics is production-only so analytics never reports from the beta environment
  // (it runs as NODE_ENV=production, so the only thing keeping it silent is the absence of
  // GA_MEASUREMENT_ID).
  { envVar: 'GA_MEASUREMENT_ID', parameter: 'ga-measurement-id', secret: false, productionOnly: true },
  { envVar: 'GA_API_SECRET', parameter: 'ga-api-secret', secret: true, productionOnly: true },
  { envVar: 'DRAFTMANCER_API_KEY', parameter: 'draftmancer-api-key', secret: true },
  { envVar: 'MANAMATRIX_API_KEY', parameter: 'manamatrix-api-key', secret: true },
  // Cloudflare R2 — read by uploadAssets (deploy) and injected into the
  // jobs env at synth (sync_card_images + update_cards image URLs).
  { envVar: 'R2_ENDPOINT', parameter: 'r2-endpoint', secret: false },
  { envVar: 'R2_ACCESS_KEY_ID', parameter: 'r2-access-key-id', secret: true },
  { envVar: 'R2_SECRET_ACCESS_KEY', parameter: 'r2-secret-access-key', secret: true },
  { envVar: 'R2_BUCKET', parameter: 'r2-bucket', secret: false },
  { envVar: 'CARD_IMAGE_BASE_URL', parameter: 'card-image-base-url', secret: false },
];

// The R2 credentials `npm run upload-assets` writes the static assets with. With secretsFromSsm
// they are not part of the build environment; the upload command reads them itself (below).
const R2_UPLOAD_PARAMETERS = ['r2-access-key-id', 'r2-secret-access-key'];

const buildParametersFor = (production: boolean, secretsFromSsm: boolean): BuildParameter[] =>
  BUILD_PARAMETERS.filter((p) => (production || !p.productionOnly) && !(secretsFromSsm && p.secret));

const deployEnvironmentVariables = (
  props: DeploymentPipelineProps,
  segment: string,
  production: boolean,
  secretsFromSsm: boolean,
): { [name: string]: codebuild.BuildEnvironmentVariable } => ({
  AWS_ACCOUNT_ID: {
    value: props.account,
  },
  AWS_DEFAULT_REGION: {
    value: props.region,
  },
  ...Object.fromEntries(
    buildParametersFor(production, secretsFromSsm).map((p) => [
      p.envVar,
      { type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE, value: `/cubecobra/${segment}/${p.parameter}` },
    ]),
  ),
});

/**
 * The static-asset upload step. Without secretsFromSsm the R2 keys are already in the build
 * environment. With it, the asset upload is the one build step that still needs R2 write
 * credentials, so it reads them from the existing /cubecobra/<segment>/r2-* parameters (not the
 * runtime /secrets/ ones) inside a subshell, right before the upload: they never reach `npm ci`,
 * the package builds, `cdk deploy` or the synthesized template, and any SSM error fails the build.
 */
const uploadAssetsCommand = (segment: string, secretsFromSsm: boolean): string =>
  secretsFromSsm
    ? `( R2_UPLOAD_KEY_ID="$(aws ssm get-parameter --name /cubecobra/${segment}/r2-access-key-id --with-decryption --query Parameter.Value --output text)" && R2_UPLOAD_SECRET="$(aws ssm get-parameter --name /cubecobra/${segment}/r2-secret-access-key --with-decryption --query Parameter.Value --output text)" && R2_ACCESS_KEY_ID="$R2_UPLOAD_KEY_ID" R2_SECRET_ACCESS_KEY="$R2_UPLOAD_SECRET" npm run upload-assets --workspace=packages/scripts )`
    : 'npm run upload-assets --workspace=packages/scripts';

export class DeploymentPipeline extends Construct {
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: DeploymentPipelineProps) {
    super(scope, id);

    // Create artifact bucket
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `cubecobra-pipeline-artifacts-${props.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
    });

    // Source artifact
    const sourceOutput = new codepipeline.Artifact('SourceOutput');

    // SSM path segments of the stages' parameters (/cubecobra/beta/..., /cubecobra/prod/...)
    const betaSegment = ssmSegmentFor('beta');
    const productionSegment = ssmSegmentFor('production');

    // SECURITY NOTE (H-07 / M-12): the deploy projects below still run `npm ci` (with dependency
    // lifecycle scripts) and the package builds in the same CodeBuild project, with the same role,
    // that later runs `cdk deploy`, and every PARAMETER_STORE secret below is in the build
    // environment from the start of the build. The role is scoped to what the buildspec calls
    // directly (see grantDeployPermissions), but it can still assume the CDK deploy role, which is
    // admin-equivalent through the CloudFormation execution role. Remaining work:
    //   1. split each stage into an unprivileged build project (no secrets, no deploy role) that
    //      emits the bundles as artifacts, and a deploy project that only uploads them and runs
    //      `cdk deploy` (and `npm ci --ignore-scripts` + `npm rebuild <vetted native pkgs>` there);
    //   2. turn on config.ts secretsFromSsm for each stage (beta, then production; see
    //      packages/docs/maintenance/secrets-migration.md). For a flagged stage the services load
    //      their secrets from SSM at runtime, the project below gets only the non-secret
    //      parameters, and its SSM read grant excludes /cubecobra/<segment>/secrets/.

    // Create CodeBuild project for deploying to beta
    const betaDeployProject = new codebuild.PipelineProject(this, 'BetaDeployProject', {
      projectName: 'CubeCobra-Deploy-Beta',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        // Required for `docker build` of the jobs image.
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 22,
            },
          },
          pre_build: {
            commands: [
              'node --version',
              'echo Installing dependencies...',
              // npm ci installs exactly what the root package-lock.json pins (and fails if it is
              // out of sync with package.json) instead of re-resolving semver ranges.
              'npm ci',
              'echo Building application...',
              'npm run ci-build',
              'echo Publishing server artifact...',
              'export BUILD_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'cd packages/scripts && npx tsx src/publish.ts && cd ../..',
              'echo Publishing recommender service artifact...',
              'cd packages/recommenderService && node publish.js && cd ../..',
              'echo Building and publishing Lambda function...',
              'cd packages/dailyJobsLambda',
              'npm run build',
              `export CUBECOBRA_APP_BUCKET=${props.appBucket}`,
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
              'echo Building and publishing Card Update Monitor Lambda...',
              'cd packages/cardUpdateMonitorLambda',
              'npm run build',
              `export CUBECOBRA_APP_BUCKET=${props.appBucket}`,
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
              'echo Building and publishing Bot Deckbuild Lambda...',
              'cd packages/botDeckbuildLambda',
              'npm run build',
              `export CUBECOBRA_APP_BUCKET=${props.appBucket}`,
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
            ],
          },
          build: {
            commands: [
              // Upload static assets to R2 BEFORE the main stack rolls EB so new
              // instances can resolve their hashed bundle URLs immediately.
              'echo Uploading static assets to R2...',
              uploadAssetsCommand(betaSegment, props.betaSecretsFromSsm),
              // NOTE: the ML model is NOT mirrored here. It's a ~500 MB bundle
              // that changes ~once a year, so it's a one-shot manual upload
              // into the R2 assets bucket (see scripts/uploadMLModel.ts), not a
              // per-deploy step.
              // With secretsFromSsm the services read RECOMMENDER_SHARED_SECRET from SSM themselves.
              ...(props.betaSecretsFromSsm
                ? []
                : [
                    'echo Reading optional recommender shared secret...',
                    exportRecommenderSharedSecret(`/cubecobra/${betaSegment}/recommender-shared-secret`),
                  ]),
              'echo Deploying to Beta environment...',
              'cd packages/cdk',
              `npx cdk deploy ${props.betaStackName} --require-approval never --context environment=beta --context version=$CODEBUILD_RESOLVED_SOURCE_VERSION`,
              'cd ../..',
              'echo Building and pushing jobs Docker image...',
              `export JOBS_ECR_REPO=$(aws cloudformation describe-stacks --stack-name ${props.betaStackName} --query "Stacks[0].Outputs[?contains(OutputKey, \\\`JobsEcr\\\`) && contains(OutputKey, \\\`RepositoryUri\\\`)].OutputValue | [0]" --output text)`,
              'echo Jobs ECR Repository: $JOBS_ECR_REPO',
              "export ECR_REGISTRY=$(echo $JOBS_ECR_REPO | cut -d'/' -f1)",
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY',
              'docker build -t cubecobra-jobs:$CODEBUILD_RESOLVED_SOURCE_VERSION -f packages/jobs/Dockerfile .',
              'docker tag cubecobra-jobs:$CODEBUILD_RESOLVED_SOURCE_VERSION $JOBS_ECR_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'docker tag cubecobra-jobs:$CODEBUILD_RESOLVED_SOURCE_VERSION $JOBS_ECR_REPO:latest',
              'docker push $JOBS_ECR_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'docker push $JOBS_ECR_REPO:latest',
            ],
          },
        },
      }),
      environmentVariables: deployEnvironmentVariables(props, betaSegment, false, props.betaSecretsFromSsm),
    });

    this.grantDeployPermissions(betaDeployProject, props, props.betaStackName);

    this.grantBuildParameterRead(betaDeployProject, props, betaSegment, false, props.betaSecretsFromSsm);

    // Create CodeBuild project for integration tests
    const integrationTestProject = new codebuild.PipelineProject(this, 'IntegrationTestProject', {
      projectName: 'CubeCobra-Integration-Tests',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.LARGE,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 22,
            },
            commands: ['node --version', 'echo Installing Node.js dependencies...', 'npm ci'],
          },
          build: {
            commands: [
              'echo Running integration tests against beta environment...',
              'npx playwright install --with-deps chromium',
              'npm run generate-test-config --workspace=packages/integrationTests',
              `cd packages/integrationTests && BASE_URL=https://${props.betaDomain} npx playwright test --reporter=dot --reporter=html --project=chromium`,
            ],
          },
        },
        reports: {
          'integration-test-report': {
            files: ['packages/integrationTests/playwright-report/**/*'],
            'file-format': 'JUNITXML',
          },
        },
        artifacts: {
          files: ['packages/integrationTests/playwright-report/**/*'],
          name: 'IntegrationTestReport',
        },
      }),
      environmentVariables: {
        CI: {
          value: 'true',
        },
        AWS_ENDPOINT: {
          value: 'http://localhost:4566',
        },
        AWS_ACCESS_KEY_ID: {
          value: 'test',
        },
        AWS_SECRET_ACCESS_KEY: {
          value: 'test',
        },
        AWS_DEFAULT_REGION: {
          value: 'us-east-1',
        },
      },
    });

    // No extra role permissions for the integration tests: they only drive a browser against the
    // public beta site (no ECR/ECR Public pulls, no LocalStack container), and the AWS_* variables
    // above are LocalStack dummies. CodeBuild/CodePipeline add the log and artifact-bucket grants.

    // Create CodeBuild project for deploying to production
    const prodDeployProject = new codebuild.PipelineProject(this, 'ProdDeployProject', {
      projectName: 'CubeCobra-Deploy-Production',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        // Required for `docker build` of the jobs image.
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 22,
            },
          },
          pre_build: {
            commands: [
              'node --version',
              'echo Installing dependencies...',
              'npm ci',
              'echo Building application...',
              'npm run ci-build',
              'echo Publishing server artifact...',
              'export BUILD_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'cd packages/scripts && npx tsx src/publish.ts && cd ../..',
              'echo Publishing recommender service artifact...',
              'cd packages/recommenderService && node publish.js && cd ../..',
              'echo Building and publishing Lambda function...',
              'cd packages/dailyJobsLambda',
              'npm run build',
              `export CUBECOBRA_APP_BUCKET=${props.appBucket}`,
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
              'echo Building and publishing Card Update Monitor Lambda...',
              'cd packages/cardUpdateMonitorLambda',
              'npm run build',
              `export CUBECOBRA_APP_BUCKET=${props.appBucket}`,
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
              'echo Building and publishing Bot Deckbuild Lambda...',
              'cd packages/botDeckbuildLambda',
              'npm run build',
              `export CUBECOBRA_APP_BUCKET=${props.appBucket}`,
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
            ],
          },
          build: {
            commands: [
              'echo Uploading static assets to R2...',
              uploadAssetsCommand(productionSegment, props.productionSecretsFromSsm),
              // NOTE: the ML model is NOT mirrored here. It's a ~500 MB bundle
              // that changes ~once a year, so it's a one-shot manual upload
              // into the R2 assets bucket (see scripts/uploadMLModel.ts), not a
              // per-deploy step.
              ...(props.productionSecretsFromSsm
                ? []
                : [
                    'echo Reading optional recommender shared secret...',
                    exportRecommenderSharedSecret(`/cubecobra/${productionSegment}/recommender-shared-secret`),
                  ]),
              'echo Deploying to Production environment...',
              'cd packages/cdk',
              `npx cdk deploy ${props.productionStackName} --require-approval never --context environment=production --context version=$CODEBUILD_RESOLVED_SOURCE_VERSION`,
              'cd ../..',
              'echo Building and pushing jobs Docker image...',
              `export JOBS_ECR_REPO=$(aws cloudformation describe-stacks --stack-name ${props.productionStackName} --query "Stacks[0].Outputs[?contains(OutputKey, \\\`JobsEcr\\\`) && contains(OutputKey, \\\`RepositoryUri\\\`)].OutputValue | [0]" --output text)`,
              'echo Jobs ECR Repository: $JOBS_ECR_REPO',
              "export ECR_REGISTRY=$(echo $JOBS_ECR_REPO | cut -d'/' -f1)",
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY',
              'docker build -t cubecobra-jobs:$CODEBUILD_RESOLVED_SOURCE_VERSION -f packages/jobs/Dockerfile .',
              'docker tag cubecobra-jobs:$CODEBUILD_RESOLVED_SOURCE_VERSION $JOBS_ECR_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'docker tag cubecobra-jobs:$CODEBUILD_RESOLVED_SOURCE_VERSION $JOBS_ECR_REPO:latest',
              'docker push $JOBS_ECR_REPO:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'docker push $JOBS_ECR_REPO:latest',
            ],
          },
        },
      }),
      environmentVariables: deployEnvironmentVariables(props, productionSegment, true, props.productionSecretsFromSsm),
    });

    this.grantDeployPermissions(prodDeployProject, props, props.productionStackName);

    this.grantBuildParameterRead(prodDeployProject, props, productionSegment, true, props.productionSecretsFromSsm);

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'CubeCobra-Deployment-Pipeline',
      artifactBucket,
      restartExecutionOnUpdate: true,
    });

    // Grant pipeline permission to use CodeConnections
    this.pipeline.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['codeconnections:UseConnection'],
        resources: [props.codestarConnectionArn],
      }),
    );

    // Stage 1: Source
    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipelineActions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub_Source',
          owner: props.githubOwner,
          repo: props.githubRepo,
          branch: props.githubBranch,
          connectionArn: props.codestarConnectionArn,
          output: sourceOutput,
        }),
      ],
    });

    // Stage 2: Deploy to Beta
    this.pipeline.addStage({
      stageName: 'DeployBeta',
      actions: [
        new codepipelineActions.CodeBuildAction({
          actionName: 'Deploy_To_Beta',
          project: betaDeployProject,
          input: sourceOutput,
        }),
      ],
    });

    // Stage 3: Integration Tests
    this.pipeline.addStage({
      stageName: 'IntegrationTests',
      actions: [
        new codepipelineActions.CodeBuildAction({
          actionName: 'Run_Integration_Tests',
          project: integrationTestProject,
          input: sourceOutput,
        }),
      ],
    });

    // Stage 4: Deploy to Production
    this.pipeline.addStage({
      stageName: 'DeployProduction',
      actions: [
        new codepipelineActions.CodeBuildAction({
          actionName: 'Deploy_To_Production',
          project: prodDeployProject,
          input: sourceOutput,
        }),
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'The name of the deployment pipeline',
    });

    new cdk.CfnOutput(this, 'PipelineArn', {
      value: this.pipeline.pipelineArn,
      description: 'The ARN of the deployment pipeline',
    });
  }

  /**
   * Lets a deploy project read its Parameter Store values. Without secretsFromSsm that is the whole
   * /cubecobra/<segment>/ tree (the PARAMETER_STORE env vars, plus the optional recommender shared
   * secret the buildspec reads with the AWS CLI). With it, exactly the non-secret parameters in the
   * build environment plus the R2 upload credentials uploadAssetsCommand reads -- in particular
   * nothing under /cubecobra/<segment>/secrets/.
   */
  private grantBuildParameterRead(
    project: codebuild.PipelineProject,
    props: DeploymentPipelineProps,
    segment: string,
    production: boolean,
    secretsFromSsm: boolean,
  ) {
    const parameterArn = (name: string) =>
      `arn:aws:ssm:${props.region}:${props.account}:parameter/cubecobra/${segment}/${name}`;
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: secretsFromSsm
          ? [...buildParametersFor(production, true).map((p) => p.parameter), ...R2_UPLOAD_PARAMETERS].map(parameterArn)
          : [parameterArn('*')],
      }),
    );
  }

  /**
   * Grants a deploy project only the AWS calls its buildspec makes with the project role itself.
   *
   * The CloudFormation, Elastic Beanstalk, EC2, IAM, ACM and Route 53 work all happens inside
   * `cdk deploy`, which assumes the CDK bootstrap roles (deploy role -> CloudFormation execution
   * role) rather than using these credentials, so this role no longer gets `cloudformation:*`,
   * `ec2:*`, `elasticbeanstalk:*`, `iam:PassRole`, `s3:*`, `acm:*`, `cloudfront:*` or `route53:*`.
   * (The CloudFront assets stack these used to cover has been removed; the Route 53 hosted-zone
   * and VPC lookups are served from cdk.context.json, or the lookup role if the cache misses.)
   * If `cdk deploy` ever logs "could not be used to assume ... Proceeding anyway", it fell back to
   * these credentials and the beta deploy will fail on permissions -- fix the bootstrap role trust
   * rather than re-widening this role.
   *
   * What the role still calls directly:
   *  - sts:AssumeRole on the bootstrap roles (`cdk deploy`);
   *  - s3:PutObject for the bundle uploads (publish.ts, recommenderService/publish.js, the lambda
   *    publish.js scripts; AbortMultipartUpload for lib-storage's multipart cleanup);
   *  - cloudformation:DescribeStacks on its own stack (reads the jobs ECR repository output);
   *  - ECR login + push of the jobs image. The repositories have CloudFormation-generated names,
   *    so the push is scoped to this account/region's repositories rather than one ARN.
   * Reading the PARAMETER_STORE environment variables is granted separately per stage.
   */
  private grantDeployPermissions(
    project: codebuild.PipelineProject,
    props: DeploymentPipelineProps,
    stackName: string,
  ) {
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: CDK_BOOTSTRAP_ROLE_KINDS.map(
          (kind) => `arn:aws:iam::${props.account}:role/cdk-hnb659fds-${kind}-role-${props.account}-*`,
        ),
      }),
    );

    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
        resources: APP_BUCKET_PUBLISH_PREFIXES.map((prefix) => `arn:aws:s3:::${props.appBucket}/${prefix}/*`),
      }),
    );

    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [`arn:aws:cloudformation:${props.region}:${props.account}:stack/${stackName}/*`],
      }),
    );

    // GetAuthorizationToken has no resource-level permissions.
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );

    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
        ],
        resources: [`arn:aws:ecr:${props.region}:${props.account}:repository/*`],
      }),
    );
  }
}
