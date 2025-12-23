import documentClient from '@server/dynamo/documentClient';

import 'dotenv/config';

import { GetCommand } from '../../server/node_modules/@aws-sdk/lib-dynamodb';

/**
 * Debug the DynamoDB item structure for a notice
 */
(async () => {
  try {
    const noticeId = 'd85af568-d9c4-4533-9e11-3b36d3c6006f';

    console.log(`Fetching notice ${noticeId} directly from DynamoDB...`);

    // Get the raw DynamoDB item
    const result = await documentClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME || 'PROD_CUBECOBRA',
        Key: {
          PK: `NOTICE#${noticeId}`,
          SK: 'NOTICE',
        },
      }),
    );

    if (!result.Item) {
      console.log('Notice not found!');
      return;
    }

    console.log('\nRaw DynamoDB item:');
    console.log(JSON.stringify(result.Item, null, 2));

    console.log('\n--- Key fields ---');
    console.log(`PK: ${result.Item.PK}`);
    console.log(`SK: ${result.Item.SK}`);
    console.log(`GSI1PK: ${result.Item.GSI1PK}`);
    console.log(`GSI1SK: ${result.Item.GSI1SK}`);
    console.log(`status: ${result.Item.item?.status}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
