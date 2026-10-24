import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class ECR extends Construct {
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.repository = new ecr.Repository(this, `${id}EcrRepository`, {
      removalPolicy: RemovalPolicy.RETAIN,
      // Basic (free) vulnerability scan of every pushed image.
      imageScanOnPush: true,
      // Tags stay MUTABLE for now: the pipeline re-pushes `latest` on every deploy and the jobs
      // task definition runs `:latest` (jobs-ecs-task.ts). Making them IMMUTABLE first requires
      // pinning the task definition to the commit tag (or digest) the pipeline already pushes.
    });

    // Output the repository name and URI; the deploy buildspec reads the URI from the stack outputs
    new CfnOutput(this, `${id}RepositoryName`, {
      value: this.repository.repositoryName,
      description: 'The name of the ECR repository',
    });

    new CfnOutput(this, `${id}RepositoryUri`, {
      value: this.repository.repositoryUri,
      description: 'The URI for the ECR repository',
    });
  }
}
