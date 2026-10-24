import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { DynamodbTables } from '../lib/dynamodb-tables';
import { BaseTestStack } from './base-test-stack';

const buildTemplate = (dataProtection?: boolean): Template => {
  const app = new cdk.App();
  const stack = new BaseTestStack(app, 'TestStack');
  new DynamodbTables(stack, 'DynamoDBTables', { prefix: 'TEST', dataProtection });
  return Template.fromStack(stack);
};

test('Table has point-in-time recovery and deletion protection, and is retained', () => {
  const template = buildTemplate();

  template.hasResource('AWS::DynamoDB::Table', {
    DeletionPolicy: 'Retain',
    Properties: Match.objectLike({
      TableName: 'TEST_CUBECOBRA',
      DeletionProtectionEnabled: true,
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    }),
  });
});

test('Data protection can be turned off (LocalStack) without emitting the properties', () => {
  const template = buildTemplate(false);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'TEST_CUBECOBRA',
    DeletionProtectionEnabled: Match.absent(),
    PointInTimeRecoverySpecification: Match.absent(),
  });
});
