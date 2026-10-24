import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * The BootstrapStack held resources needed before deployment could be automated: a GitHub Actions
 * OIDC provider, an IAM role GitHub Actions could assume to push to ECR, and the
 * /cdk/bootstrap/github-actions-role-arn SSM parameter that pointed the CubeCobra stacks at it.
 *
 * Nothing uses them any more (no workflow requests `id-token: write`; images are pushed by the
 * CodePipeline deploy projects) and the role trusted any ref of the repository, so they have been
 * removed (M-14). This stack intentionally defines no resources now.
 *
 * To tear the old resources down, after BOTH CubeCobraBetaStack and CubeCobraProdStack have been
 * deployed from a commit that no longer references /cdk/bootstrap/github-actions-role-arn (a
 * rollback of an older stack template would need that parameter), run once per previously
 * bootstrapped environment:
 *
 *   npx cdk deploy --context environment=<environment> --context bootstrap=true
 *
 * or delete the BootstrapStack<environment> CloudFormation stack directly. Before doing so, check
 * that no other IAM role in the account trusts the token.actions.githubusercontent.com OIDC
 * provider (it is account-wide); if one does, keep the provider.
 */
export class BootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
  }
}
