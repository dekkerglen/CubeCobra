import documentClient from '@server/dynamo/documentClient';
import { NoticeStatus } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

import { GetCommand } from '../../server/node_modules/@aws-sdk/lib-dynamodb';

/**
 * Compare statuses between new table (using DAO query) and old table (batch get)
 */
(async () => {
  try {
    console.log('Step 1: Query active notices from new table using admin page query...');
    const activeNotices = await noticeDao.getByStatus(NoticeStatus.ACTIVE);
    console.log(`Found ${activeNotices.items.length} active notices in new table\n`);

    console.log('Step 2: Batch get those same notices from old PROD_NOTICES table...');

    const oldTableName = 'PROD_NOTICES';
    const BATCH_SIZE = 100; // DynamoDB limit
    const mismatches: any[] = [];
    const notInOldTable: string[] = [];
    const matching: number[] = [0]; // wrapped in array to allow mutation in loop

    let processed = 0;

    for (let i = 0; i < activeNotices.items.length; i += BATCH_SIZE) {
      const batch = activeNotices.items.slice(i, Math.min(i + BATCH_SIZE, activeNotices.items.length));

      // Get each notice individually from old table
      const oldNoticeResults = await Promise.all(
        batch.map(async (notice) => {
          try {
            const getCommand = new GetCommand({
              TableName: oldTableName,
              Key: { id: notice.id },
            });
            const result = await documentClient.send(getCommand);
            return result.Item || null;
          } catch (error) {
            console.error(`Error getting notice ${notice.id} from old table:`, error);
            return null;
          }
        }),
      );

      // Compare statuses
      batch.forEach((newNotice, index) => {
        const oldNotice = oldNoticeResults[index];

        if (!oldNotice) {
          notInOldTable.push(newNotice.id);
        } else if (oldNotice.status !== newNotice.status) {
          mismatches.push({
            id: newNotice.id,
            oldStatus: oldNotice.status,
            newStatus: newNotice.status,
            date: new Date(newNotice.date),
            type: newNotice.type,
          });
        } else {
          matching[0] += 1;
        }
      });

      processed += batch.length;
      console.log(`Processed ${processed}/${activeNotices.items.length}...`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('COMPARISON RESULTS');
    console.log('='.repeat(80));
    console.log(`Total active notices in new table: ${activeNotices.items.length}`);
    console.log(`Matching statuses (both 'a'): ${matching[0]}`);
    console.log(`Not found in old table: ${notInOldTable.length}`);
    console.log(`STATUS MISMATCHES (old='p', new='a'): ${mismatches.length}`);

    if (mismatches.length > 0) {
      console.log('\n❌ MIGRATION FAILED! Found notices marked as processed in old table but active in new table:');
      console.log('\nFirst 20 mismatches:');
      mismatches.slice(0, 20).forEach((m) => {
        console.log(
          `  ${m.id}: old='${m.oldStatus}', new='${m.newStatus}', date=${m.date.toISOString().split('T')[0]}, type=${m.type}`,
        );
      });

      if (mismatches.length > 20) {
        console.log(`  ... and ${mismatches.length - 20} more`);
      }
    } else {
      console.log('\n✅ No mismatches found. All active notices in new table are also active in old table.');
    }

    if (notInOldTable.length > 0) {
      console.log(`\nℹ️  ${notInOldTable.length} notices not found in old table (likely created after migration)`);
    }
  } catch (error) {
    console.error('Error comparing statuses:', error);
    process.exit(1);
  }
})();
