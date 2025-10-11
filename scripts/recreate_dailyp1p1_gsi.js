// Load Environment Variables
require('dotenv').config();

const { UpdateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const client = require('../build/dynamo/client');

const tableName = `${process.env.DYNAMO_PREFIX}_DAILY_P1P1`;

const waitForTableActive = async (maxWaitTime = 600000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTime) {
    const describeCommand = new DescribeTableCommand({ TableName: tableName });
    const response = await client.send(describeCommand);

    const tableStatus = response.Table.TableStatus;
    const gsiStatuses = response.Table.GlobalSecondaryIndexes?.map(gsi => ({
      name: gsi.IndexName,
      status: gsi.IndexStatus,
    })) || [];

    console.log(`Table status: ${tableStatus}`);
    if (gsiStatuses.length > 0) {
      console.log('GSI statuses:', gsiStatuses);
    }

    const allActive = tableStatus === 'ACTIVE' &&
      gsiStatuses.every(gsi => gsi.status === 'ACTIVE');

    if (allActive) {
      console.log('Table and all GSIs are ACTIVE');
      return;
    }

    console.log('Waiting for table to be active...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Timeout waiting for table to be active');
};

(async () => {
  try {
    console.log(`Recreating ByDate GSI for table ${tableName}`);

    // First, check if the GSI already exists
    const describeCommand = new DescribeTableCommand({ TableName: tableName });
    const describeResponse = await client.send(describeCommand);

    const existingGSIs = describeResponse.Table.GlobalSecondaryIndexes || [];
    const byDateGSI = existingGSIs.find(gsi => gsi.IndexName === 'ByDate');

    if (byDateGSI) {
      console.log('ByDate GSI already exists. Skipping creation.');
      console.log('Current GSI configuration:', JSON.stringify(byDateGSI, null, 2));
      process.exit(0);
    }

    // Create the ByDate GSI
    const updateCommand = new UpdateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [
        {
          AttributeName: 'type',
          AttributeType: 'S',
        },
        {
          AttributeName: 'date',
          AttributeType: 'N',
        },
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: 'ByDate',
            KeySchema: [
              {
                AttributeName: 'type',
                KeyType: 'HASH',
              },
              {
                AttributeName: 'date',
                KeyType: 'RANGE',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        },
      ],
    });

    console.log('Sending UpdateTable command...');
    const updateResponse = await client.send(updateCommand);
    console.log('UpdateTable response:', JSON.stringify(updateResponse, null, 2));

    console.log('Waiting for GSI to be created and active...');
    await waitForTableActive();

    console.log('GSI creation complete!');
    process.exit(0);
  } catch (err) {
    console.error('GSI creation failed:', err);
    process.exit(1);
  }
})();
