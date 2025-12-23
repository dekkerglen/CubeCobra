import documentClient from '@server/dynamo/documentClient';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

import { ScanCommand } from '../../server/node_modules/@aws-sdk/lib-dynamodb';

/**
 * Script to fix notice statuses by copying from old PROD_NOTICES table
 */
(async () => {
  try {
    console.log('Fixing notice statuses...');
    console.log('='.repeat(80));

    const oldTableName = 'PROD_NOTICES';

    // Scan old NOTICES table for all processed notices
    console.log(`Scanning ${oldTableName} for processed notices...`);

    let processedNotices: any[] = [];
    let lastKey: any = undefined;
    let totalScanned = 0;

    do {
      const scanCommand = new ScanCommand({
        TableName: oldTableName,
        FilterExpression: '#status = :processed',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':processed': 'p',
        },
        ExclusiveStartKey: lastKey,
      });

      const result = await documentClient.send(scanCommand);
      if (result.Items) {
        processedNotices = processedNotices.concat(result.Items);
      }
      lastKey = result.LastEvaluatedKey;
      totalScanned += result.Count || 0;

      console.log(`Scanned ${totalScanned} items, found ${processedNotices.length} processed notices...`);
    } while (lastKey);

    console.log(`\nFound ${processedNotices.length} processed notices in old table`);

    if (processedNotices.length === 0) {
      console.log('No processed notices found to update.');
      return;
    }

    // Update each processed notice in the new table
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('\nUpdating notices in new table (batch processing)...');

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(processedNotices.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, processedNotices.length);
      const batch = processedNotices.slice(start, end);

      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (notices ${start + 1}-${end})...`);

      const results = await Promise.all(
        batch.map(async (oldNotice) => {
          try {
            // Log first item in first batch to see structure
            if (batchIndex === 0 && batch[0] === oldNotice) {
              console.log(`  Sample old notice:`, JSON.stringify(oldNotice, null, 2));
            }

            const newNotice = await noticeDao.getById(oldNotice.id);

            if (!newNotice) {
              console.log(`  NOT FOUND: old notice ID ${oldNotice.id}`);
              return { status: 'not_found', id: oldNotice.id };
            }

            // Log first found notice to see structure
            if (batchIndex === 0 && batch[0] === oldNotice) {
              console.log(
                `  Sample new notice:`,
                JSON.stringify({ id: newNotice.id, status: newNotice.status }, null, 2),
              );
            }

            if (newNotice.status === NoticeStatus.PROCESSED) {
              console.log(`  ALREADY PROCESSED: notice ${oldNotice.id}`);
              return { status: 'skipped' };
            }

            // Update the status
            newNotice.status = NoticeStatus.PROCESSED;
            await noticeDao.update(newNotice);
            return { status: 'updated' };
          } catch (error) {
            return { status: 'error', id: oldNotice.id, error };
          }
        }),
      );

      // Count results
      results.forEach((result) => {
        if (result.status === 'updated') updated += 1;
        else if (result.status === 'skipped') skipped += 1;
        else if (result.status === 'error') {
          errors += 1;
          console.error(`  Error updating notice ${result.id}:`, result.error);
        } else if (result.status === 'not_found') {
          skipped += 1;
          console.log(`  Notice ${result.id} not found in new table`);
        }
      });

      console.log(`  Batch complete: ${updated} updated, ${skipped} skipped, ${errors} errors so far`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('Status fix complete!');
    console.log(`Total processed notices in old table: ${processedNotices.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Already correct (skipped): ${skipped}`);
    console.log(`Errors: ${errors}`);
  } catch (error) {
    console.error('Error fixing notice statuses:', error);
    process.exit(1);
  }
})();
