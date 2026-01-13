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
}

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
    const betaBuildOutput = new codepipeline.Artifact('BetaBuildOutput');

    // Create CodeBuild project for deploying to beta
    const betaDeployProject = new codebuild.PipelineProject(this, 'BetaDeployProject', {
      projectName: 'CubeCobra-Deploy-Beta',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Installing dependencies...',
              'npm install',
              'echo Building application...',
              'npm run ci-build',
              'echo Publishing server artifact...',
              'export BUILD_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'cd packages/scripts && npx ts-node -r tsconfig-paths/register --project tsconfig.json src/publish.ts && cd ../..',
              'echo Building and publishing Lambda function...',
              'cd packages/dailyJobsLambda',
              'npm run build',
              'export CUBECOBRA_APP_BUCKET=cubecobra',
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
            ],
          },
          build: {
            commands: [
              'echo Deploying to Beta environment...',
              'cd packages/cdk',
              'npx cdk deploy --require-approval never --context environment=beta --context version=$CODEBUILD_RESOLVED_SOURCE_VERSION',
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
        DRAFTMANCER_API_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/beta/draftmancer-api-key',
        },
      },
    });

    // Grant permissions to deploy
    betaDeployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole', 'iam:PassRole', 'cloudformation:*', 'ec2:*', 'elasticbeanstalk:*', 's3:*'],
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
            commands: [
              'echo Installing Python and AWS CLI...',
              'pip install awscli awscli-local',
              'echo Installing Node.js dependencies...',
              'npm install',
            ],
          },
          pre_build: {
            commands: [
              'echo Starting LocalStack...',
              'docker run -d -p 4566:4566 -e DYNAMODB_HEAP_SIZE=2G -e PROVIDER_OVERRIDE_CLOUDFORMATION=engine-legacy gresau/localstack-persist:4.12',
              'sleep 10',
              'echo Initializing LocalStack...',
              'awslocal s3 mb s3://local || true',
              'awslocal ses verify-email-identity --email support@cubecobra.com || true',
              'echo Building client and server...',
              'npm run build --workspace=packages/client',
              'npm run build --workspace=packages/server',
              'npm run create-mock-files --workspace=packages/scripts',
            ],
          },
          build: {
            commands: [
              'echo Running integration tests against beta...',
              'npm run playwright:install --workspace=packages/integrationTests',
              `BASE_URL=https://${props.betaDomain} npx playwright test --reporter=dot --reporter=html --project=chromium`,
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

    // Grant Docker permissions for LocalStack
    integrationTestProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:*', 'ecr-public:*'],
        resources: ['*'],
      }),
    );

    // Create CodeBuild project for deploying to production
    const prodDeployProject = new codebuild.PipelineProject(this, 'ProdDeployProject', {
      projectName: 'CubeCobra-Deploy-Production',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Installing dependencies...',
              'npm install',
              'echo Building application...',
              'npm run ci-build',
              'echo Publishing server artifact...',
              'export BUILD_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'cd packages/scripts && npx ts-node -r tsconfig-paths/register --project tsconfig.json src/publish.ts && cd ../..',
              'echo Building and publishing Lambda function...',
              'cd packages/dailyJobsLambda',
              'npm run build',
              'export CUBECOBRA_APP_BUCKET=cubecobra',
              'export LAMBDA_VERSION=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'node publish.js',
              'cd ../..',
            ],
          },
          build: {
            commands: [
              'echo Deploying to Production environment...',
              'cd packages/cdk',
              'npx cdk deploy --require-approval never --context environment=production --context version=$CODEBUILD_RESOLVED_SOURCE_VERSION',
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
        DRAFTMANCER_API_KEY: {
          type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
          value: '/cubecobra/prod/draftmancer-api-key',
        },
      },
    });

    // Grant permissions to deploy
    prodDeployProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole', 'iam:PassRole', 'cloudformation:*', 'ec2:*', 'elasticbeanstalk:*', 's3:*'],
        resources: ['*'],
      }),
    );

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
}
