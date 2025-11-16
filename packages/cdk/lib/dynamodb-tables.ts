import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { toResourceName } from './utils';

interface DynamodbTablesProps {
  prefix: string;
}

export class DynamodbTables extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamodbTablesProps) {
    super(scope, id);

    const tableName = `${props.prefix}_CUBECOBRA`;

    // If we don't create the table we'll attempt to load it so we can operate on it as needed
    if (!this.node.tryGetContext('createDynamoDBTables')) {
      this.table = dynamodb.Table.fromTableName(this, toResourceName('cubecobra-table'), tableName) as Table;

      return;
    }

    // Create single table with partition key (PK) and sort key (SK)
    const table = new dynamodb.Table(this, toResourceName('cubecobra-table'), {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Add Global Secondary Indexes
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    Tags.of(table).add('environment', props.prefix);

    this.table = table;
  }
}
