import documentClient from '@server/dynamo/documentClient';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

import { ScanCommand } from '../../server/node_modules/@aws-sdk/lib-dynamodb';

/**
 * Mark ALL notices from old PROD_NOTICES table as processed in new table
 */
(async () => {
  try {
    console.log('Marking all old notices as processed...');
    console.log('='.repeat(80));

    const oldTableName = 'PROD_NOTICES';

    // Scan old NOTICES table for ALL notices
    console.log(`Scanning ${oldTableName} for all notices...`);

    let allOldNotices: any[] = [];
    let lastKey: any = undefined;
    let totalScanned = 0;

    do {
      const scanCommand = new ScanCommand({
        TableName: oldTableName,
        ExclusiveStartKey: lastKey,
      });

      const result = await documentClient.send(scanCommand);
      if (result.Items) {
        allOldNotices = allOldNotices.concat(result.Items);
      }
      lastKey = result.LastEvaluatedKey;
      totalScanned += result.Count || 0;

      console.log(`Scanned ${totalScanned} items, found ${allOldNotices.length} notices...`);
    } while (lastKey);

    console.log(`\nFound ${allOldNotices.length} total notices in old table`);

    if (allOldNotices.length === 0) {
      console.log('No notices found to update.');
      return;
    }

    // Update each notice in the new table to PROCESSED
    let updated = 0;
    let alreadyProcessed = 0;
    let notFound = 0;
    let errors = 0;

    console.log('\nUpdating notices in new table (batch processing)...');

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(allOldNotices.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allOldNotices.length);
      const batch = allOldNotices.slice(start, end);

      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (notices ${start + 1}-${end})...`);

      const results = await Promise.all(
        batch.map(async (oldNotice) => {
          try {
            const newNotice = await noticeDao.getById(oldNotice.id);

            if (!newNotice) {
              return { status: 'not_found', id: oldNotice.id };
            }

            if (newNotice.status === NoticeStatus.PROCESSED) {
              return { status: 'already_processed' };
            }

            // Update the status to PROCESSED
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
        else if (result.status === 'already_processed') alreadyProcessed += 1;
        else if (result.status === 'error') {
          errors += 1;
          console.error(`  Error updating notice ${result.id}:`, result.error);
        } else if (result.status === 'not_found') {
          notFound += 1;
        }
      });

      console.log(
        `  Batch complete: ${updated} updated, ${alreadyProcessed} already processed, ${notFound} not found, ${errors} errors`,
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('Processing complete!');
    console.log(`Total notices in old table: ${allOldNotices.length}`);
    console.log(`Updated to PROCESSED: ${updated}`);
    console.log(`Already PROCESSED: ${alreadyProcessed}`);
    console.log(`Not found in new table: ${notFound}`);
    console.log(`Errors: ${errors}`);
    console.log('\n✅ All old notices marked as processed. Only new notices (created after migration) will be active.');
  } catch (error) {
    console.error('Error marking notices as processed:', error);
    process.exit(1);
  }
})();
