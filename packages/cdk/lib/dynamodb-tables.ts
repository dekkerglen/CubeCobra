import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { AttributeType, BillingMode, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
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

    // GSI3/GSI4 use a KEYS_ONLY projection. They are write-heavy (every cube and
    // draft write fans into them) but read-cold — they back niche access patterns
    // (card-count / recency sort, drafts-by-owner/type, episodes-by-podcast,
    // packages-by-owner). A full (ALL) projection would replicate every item
    // attribute into each index, paying storage and per-write cost for payload
    // that the read paths re-fetch from the base table anyway. KEYS_ONLY stores
    // only the key attributes; the DAO read layer resolves full items via a
    // BatchGet against the base table (see BaseDynamoDao.queryKeysOnlyIndex).
    table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: AttributeType.STRING },
      projectionType: ProjectionType.KEYS_ONLY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI4',
      partitionKey: { name: 'GSI4PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI4SK', type: AttributeType.STRING },
      projectionType: ProjectionType.KEYS_ONLY,
    });

    Tags.of(table).add('environment', props.prefix);

    this.table = table;
  }
}
