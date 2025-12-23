// Script to directly query DynamoDB GSI3 to debug
require('dotenv').config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const run = async () => {
  try {
    const tableName = process.env.DYNAMO_TABLE;
    if (!tableName) {
      console.error('DYNAMO_TABLE not set');
      process.exit(1);
    }

    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    const podcastId = '5f5bacfef0a560104412d522'; // Lucky Paper Radio
    const gsi3pk = `EPISODE#PODCAST#${podcastId}`;

    console.log(`Querying GSI3 for: ${gsi3pk}\n`);

    // Query without the status filter first
    const params = {
      TableName: tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: {
        ':pk': gsi3pk,
      },
      Limit: 5,
    };

    console.log('Query params:', JSON.stringify(params, null, 2));

    const result = await docClient.send(new QueryCommand(params));

    console.log(`\nQuery returned ${result.Items?.length || 0} items`);

    if (result.Items && result.Items.length > 0) {
      console.log('\nFirst item:');
      const item = result.Items[0];
      console.log(
        JSON.stringify(
          {
            PK: item.PK,
            SK: item.SK,
            GSI3PK: item.GSI3PK,
            GSI3SK: item.GSI3SK,
            podcast: item.item?.podcast,
            status: item.item?.status,
            title: item.item?.title,
          },
          null,
          2,
        ),
      );
    } else {
      console.log('\nNo items found! The GSI3 index might not be populated.');
      console.log('Checking if item exists with direct PK/SK query...');

      // Try to get any episode
      const scanParams = {
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':pk': 'EPISODE#',
        },
        Limit: 1,
      };

      const scanResult = await docClient.send(new QueryCommand(scanParams as any));
      console.log(`Scan found ${scanResult.Items?.length || 0} episodes`);

      if (scanResult.Items && scanResult.Items.length > 0) {
        const item = scanResult.Items[0];
        console.log('\nSample episode from scan:');
        console.log(
          JSON.stringify(
            {
              PK: item.PK,
              SK: item.SK,
              GSI3PK: item.GSI3PK,
              GSI3SK: item.GSI3SK,
              podcast: item.item?.podcast,
              status: item.item?.status,
            },
            null,
            2,
          ),
        );
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
