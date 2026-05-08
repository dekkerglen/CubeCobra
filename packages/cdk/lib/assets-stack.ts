import * as cdk from 'aws-cdk-lib';

import { AssetsDistribution } from './assets-distribution';

export interface AssetsStackProps extends cdk.StackProps {
  environmentName: string;
  domain: string;
}

/**
 * Static assets stack — lives in us-east-1 because CloudFront requires its
 * ACM certificates there for custom domains.
 *
 * Deployed before the main CubeCobraStack: the bucket and distribution must
 * exist before the deploy pipeline uploads bundles, and CDN_BASE_URL must
 * resolve before any new EB instance starts serving traffic. Both stacks are
 * wired up in `app/infra.ts`.
 */
export class AssetsStack extends cdk.Stack {
  public readonly distribution: AssetsDistribution;

  constructor(scope: cdk.App, id: string, props: AssetsStackProps) {
    super(scope, id, props);

    this.distribution = new AssetsDistribution(this, 'Assets', {
      environmentName: props.environmentName,
      domain: props.domain,
    });
  }
}
