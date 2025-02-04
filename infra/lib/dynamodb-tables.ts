import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { toResourceName } from './utils';

const tablesToCreate: Map<
  string,
  {
    partitionKey: string;
    indexes: { name: string; partitionKey: string; sortKey: string }[];
  }
> = new Map([
  [
    'content',
    {
      partitionKey: 'id',
      indexes: [
        { name: 'ByStatus', partitionKey: 'status', sortKey: 'date' },
        { name: 'ByTypeOwnerComp', partitionKey: 'typeOwnerComp', sortKey: 'date' },
        { name: 'ByTypeStatusComp', partitionKey: 'typeStatusComp', sortKey: 'date' },
      ],
    },
  ],
  [
    'notifications',
    {
      partitionKey: 'id',
      indexes: [
        { name: 'ByTo', partitionKey: 'to', sortKey: 'date' },
        { name: 'ByToStatusComp', partitionKey: 'toStatusComp', sortKey: 'date' },
      ],
    },
  ],
  [
    'users',
    {
      partitionKey: 'id',
      indexes: [
        { name: 'ByUsername', partitionKey: 'usernameLower', sortKey: '' },
        { name: 'ByEmail', partitionKey: 'email', sortKey: '' },
      ],
    },
  ],
  [
    'notices',
    {
      partitionKey: 'id',
      indexes: [{ name: 'ByStatus', partitionKey: 'status', sortKey: 'date' }],
    },
  ],
]);

interface DynamodbTablesProps {
  prefix: string;
}

export class DynamodbTables extends Construct {
  public readonly tables: Record<string, dynamodb.Table> = {};

  constructor(scope: Construct, id: string, props: DynamodbTablesProps) {
    super(scope, id);

    // If we don't create the table we'll attempt to load them so we can operate on them as needed
    if (!this.node.tryGetContext('createDynamoDBTables')) {
      tablesToCreate.forEach((_, tableName) => {
        this.tables[tableName] = dynamodb.Table.fromTableName(
          this,
          toResourceName(tableName),
          `${props.prefix}_${tableName.toUpperCase()}`,
        ) as Table;
      });

      return;
    }

    tablesToCreate.forEach((tableProps, tableName) => {
      const table = new dynamodb.Table(this, toResourceName(tableName), {
        partitionKey: { name: tableProps.partitionKey, type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        tableName: `${props.prefix}_${tableName.toUpperCase()}`,
        removalPolicy: RemovalPolicy.RETAIN,
      });

      tableProps.indexes.forEach((index) => {
        table.addGlobalSecondaryIndex({
          partitionKey: { name: index.partitionKey, type: AttributeType.STRING },
          indexName: index.name,
          sortKey: { name: index.sortKey, type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        });
      });

      Tags.of(table).add('environment', props.prefix);

      this.tables[tableName] = table;
    });
  }
}
