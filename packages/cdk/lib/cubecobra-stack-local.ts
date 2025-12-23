import * as cdk from 'aws-cdk-lib';

import { DynamodbTables } from './dynamodb-tables';
import { CubeCobraStackParams } from './types';

export class CubeCobraStackLocal extends cdk.Stack {
  constructor(scope: cdk.App, id: string, params: CubeCobraStackParams, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB single table
    new DynamodbTables(this, 'DynamoDBTables', { prefix: params.dynamoPrefix });
  }
}
