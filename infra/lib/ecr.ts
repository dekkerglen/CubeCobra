import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class ECR extends Construct {
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, pipelineRole: Role) {
    super(scope, id);

    this.repository = new ecr.Repository(this, `${id}EcrRepository`, {
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Output the repository name since we'll need it in the GitHub action
    new CfnOutput(this, `${id}RepositoryName`, {
      value: this.repository.repositoryName,
      description: 'The name of the ECR repository',
    });

    new CfnOutput(this, `${id}RepositoryUri`, {
      value: this.repository.repositoryUri,
      description: 'The URI for the ECR repository',
    });

    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:InitiateLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:CompleteLayerUpload',
          'ecr:PutImage',
        ],
        resources: [this.repository.repositoryArn],
      }),
    );

    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [Stack.of(this).stackId],
      }),
    );
  }
}
