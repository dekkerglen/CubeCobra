import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class BaseTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      env: { account: '123456789012', region: 'us-east-1' },
    });
  }
}
