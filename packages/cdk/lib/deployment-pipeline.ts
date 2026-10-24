import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

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
    });

    // Source artifact
    const sourceOutput = new codepipeline.Artifact('SourceOutput');

    // SECURITY NOTE (H-07 / M-12): the deploy projects below still run `npm ci` (with dependency
    // lifecycle scripts) and the package builds in the same CodeBuild project, with the same role,
    // that later runs `cdk deploy`, and every PARAMETER_STORE secret below is in the build
    // environment from the start of the build. The role is scoped to what the buildspec calls
    // directly (see grantDeployPermissions), but it can still assume the CDK deploy role, which is
    // admin-equivalent through the CloudFormation execution role. Remaining work:
    //   1. split each stage into an unprivileged build project (no secrets, no deploy role) that
    //      emits the bundles as artifacts, and a deploy project that only uploads them and runs
    //      `cdk deploy` (and `npm ci --ignore-scripts` + `npm rebuild <vetted native pkgs>` there);
    const betaBuildOutput = new codepipeline.Artifact('BetaBuildOutput');

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
              'npm run upload-assets --workspace=packages/scripts',
              // NOTE: the ML model is NOT mirrored here. It's a ~500 MB bundle
              // that changes ~once a year, so it's a one-shot manual upload
              // into the R2 assets bucket (see scripts/uploadMLModel.ts), not a
              // per-deploy step.
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
        artifacts: {
          files: ['**/*'],
        },
      }),
      environmentVariables: {
        AWS_ACCOUNT_ID: {
          value: props.account,
        },
        AWS_DEFAULT_REGION: {
          value: props.region,
        },
        STRIPE_SECRET_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/stripe-secret-key',
        },
        STRIPE_PUBLIC_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/stripe-public-key',
        },
        SESSION_TOKEN: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/session-token',
        },
        SESSION_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/session-secret',
        },
        JOBS_TOKEN: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/jobs-token',
        },
        PATREON_CLIENT_ID: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/patreon-client-id',
        },
        PATREON_CLIENT_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/patreon-client-secret',
        },
        PATREON_HOOK_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/patreon-hook-secret',
        },
        CAPTCHA_SITE_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/captcha-site-key',
        },
        CAPTCHA_SECRET_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/captcha-secret-key',
        },
        // GA_MEASUREMENT_ID intentionally omitted for beta so analytics never
        // reports from the beta environment (it runs as NODE_ENV=production, so
        // the only thing keeping it silent is the absence of this variable).
        DRAFTMANCER_API_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/draftmancer-api-key',
        },
        MANAMATRIX_API_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/manamatrix-api-key',
        },
        // Cloudflare R2 — read by uploadAssets (deploy) and injected into the
        // jobs env at synth (sync_card_images + update_cards image URLs).
        R2_ENDPOINT: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/r2-endpoint',
        },
        R2_ACCESS_KEY_ID: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/r2-access-key-id',
        },
        R2_SECRET_ACCESS_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/r2-secret-access-key',
        },
        R2_BUCKET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/r2-bucket',
        },
        CARD_IMAGE_BASE_URL: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/card-image-base-url',
        },
      },
    });

    this.grantDeployPermissions(betaDeployProject, props, props.betaStackName);

    // Grant permissions to push to ECR
    betaDeployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:PutImage',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
        ],
        resources: ['*'],
      }),
    );

    // Grant permissions to read Parameter Store
    betaDeployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${props.region}:${props.account}:parameter/cubecobra/beta/*`],
      }),
    );

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
              'npm run upload-assets --workspace=packages/scripts',
              // NOTE: the ML model is NOT mirrored here. It's a ~500 MB bundle
              // that changes ~once a year, so it's a one-shot manual upload
              // into the R2 assets bucket (see scripts/uploadMLModel.ts), not a
              // per-deploy step.
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
      environmentVariables: {
        AWS_ACCOUNT_ID: {
          value: props.account,
        },
        AWS_DEFAULT_REGION: {
          value: props.region,
        },
        STRIPE_SECRET_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/stripe-secret-key',
        },
        STRIPE_PUBLIC_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/stripe-public-key',
        },
        SESSION_TOKEN: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/session-token',
        },
        SESSION_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/session-secret',
        },
        JOBS_TOKEN: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/jobs-token',
        },
        PATREON_CLIENT_ID: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/patreon-client-id',
        },
        PATREON_CLIENT_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/patreon-client-secret',
        },
        PATREON_HOOK_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/patreon-hook-secret',
        },
        CAPTCHA_SITE_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/captcha-site-key',
        },
        CAPTCHA_SECRET_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/captcha-secret-key',
        },
        GA_MEASUREMENT_ID: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/ga-measurement-id',
        },
        GA_API_SECRET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/ga-api-secret',
        },
        DRAFTMANCER_API_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/draftmancer-api-key',
        },
        MANAMATRIX_API_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/manamatrix-api-key',
        },
        // Cloudflare R2 — read by uploadAssets (deploy) and injected into the
        // jobs env at synth (sync_card_images + update_cards image URLs).
        R2_ENDPOINT: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/r2-endpoint',
        },
        R2_ACCESS_KEY_ID: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/r2-access-key-id',
        },
        R2_SECRET_ACCESS_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/r2-secret-access-key',
        },
        R2_BUCKET: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/r2-bucket',
        },
        CARD_IMAGE_BASE_URL: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/card-image-base-url',
        },
      },
    });

    this.grantDeployPermissions(prodDeployProject, props, props.productionStackName);

    // Grant permissions to read Parameter Store
    prodDeployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${props.region}:${props.account}:parameter/cubecobra/prod/*`],
      }),
    );

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
          outputs: [betaBuildOutput],
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
