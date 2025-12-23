import documentClient from '@server/dynamo/documentClient';

import 'dotenv/config';

import { ScanCommand } from '../../server/node_modules/@aws-sdk/lib-dynamodb';

/**
 * Count items by GSI1PK to see how many have each status
 */
(async () => {
  try {
    console.log('Scanning DynamoDB to count by GSI1PK...');

    const statusCounts: Record<string, number> = {};
    let lastKey: any = undefined;
    let totalScanned = 0;

    do {
      const result = await documentClient.send(
        new ScanCommand({
          TableName: process.env.TABLE_NAME || 'PROD_CUBECOBRA',
          FilterExpression: 'begins_with(PK, :noticePrefix)',
          ExpressionAttributeValues: {
            ':noticePrefix': 'NOTICE#',
          },
          ProjectionExpression: 'GSI1PK, #item.#status',
          ExpressionAttributeNames: {
            '#item': 'item',
            '#status': 'status',
          },
          ExclusiveStartKey: lastKey,
        }),
      );

      if (result.Items) {
        result.Items.forEach((item) => {
          const gsi1pk = item.GSI1PK || 'NO_GSI1PK';
          statusCounts[gsi1pk] = (statusCounts[gsi1pk] || 0) + 1;
        });
      }

      lastKey = result.LastEvaluatedKey;
      totalScanned += result.Count || 0;

      console.log(`Scanned ${totalScanned} notices so far...`);
    } while (lastKey);

    console.log('\nGSI1PK distribution:');
    console.log(JSON.stringify(statusCounts, null, 2));

    console.log('\n--- Summary ---');
    console.log(`Total notices scanned: ${totalScanned}`);
    console.log(`NOTICE#STATUS#a: ${statusCounts['NOTICE#STATUS#a'] || 0}`);
    console.log(`NOTICE#STATUS#p: ${statusCounts['NOTICE#STATUS#p'] || 0}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
