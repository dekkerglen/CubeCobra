import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { Pipeline } from './pipeline';

/**
 * The BootstrapStack creates resources needed before we can properly automate deployment. It is meant to run only
 * once per environment (unless we make changes).
 */
export class BootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new Pipeline(this, 'Pipeline', {
      githubRepositories: ['dekkerglen/CubeCobra'],
    });

    new ssm.StringParameter(this, 'GitHubActionsRoleArnParameter', {
      parameterName: '/cdk/bootstrap/github-actions-role-arn',
      stringValue: pipeline.githubRole.roleArn,
    });
  }
}
