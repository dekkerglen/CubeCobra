import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';

import { DailyJobsLambdaConstruct } from '../lib/daily-jobs-lambda';
import { DynamodbTables } from '../lib/dynamodb-tables';
import { BaseTestStack } from './base-test-stack';

const buildTemplate = (): Template => {
  const app = new cdk.App();
  const stack = new BaseTestStack(app, 'TestStack');
  const tables = new DynamodbTables(stack, 'DynamoDBTables', { prefix: 'TEST' });
  new DailyJobsLambdaConstruct(stack, 'DailyJobsLambda', {
    codeArtifactsBucket: 'code-bucket',
    version: 'v1.0.0',
    subdomain: 'test',
    stage: 'production',
    environmentVariables: { DATA_BUCKET: 'test-data-bucket', DYNAMO_TABLE: 'TEST_CUBECOBRA' },
    table: tables.table,
    dataBucket: 'test-data-bucket',
  });
  return Template.fromStack(stack);
};

const lambdaRoleStatements = (template: Template): any[] =>
  Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (policy: any) => policy.Properties.PolicyDocument.Statement,
  );

const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

test('No statement uses a wildcard resource or a dynamodb:* / s3:* action', () => {
  const statements = lambdaRoleStatements(buildTemplate());
  expect(statements.length).toBeGreaterThan(0);
  for (const statement of statements) {
    expect(asArray(statement.Resource)).not.toContain('*');
    for (const action of asArray(statement.Action) as string[]) {
      expect(action).not.toBe('dynamodb:*');
      expect(action).not.toBe('s3:*');
      expect(['dynamodb:DeleteTable', 'dynamodb:CreateTable', 'dynamodb:UpdateTable']).not.toContain(action);
    }
  }
});

test('DynamoDB access is item-level on the stage table and its indexes', () => {
  const template = buildTemplate();
  const tableArn = { 'Fn::GetAtt': [Match.stringLikeRegexp('DynamoDBTables'), 'Arn'] };

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query',
            'dynamodb:BatchWriteItem',
          ]),
          Resource: [tableArn, { 'Fn::Join': ['', [tableArn, '/index/*']] }],
        }),
      ]),
    },
  });
});

test('S3 access is limited to the stage data bucket', () => {
  const template = buildTemplate();

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
          Resource: ['arn:aws:s3:::test-data-bucket', 'arn:aws:s3:::test-data-bucket/*'],
        }),
      ]),
    },
  });
});
