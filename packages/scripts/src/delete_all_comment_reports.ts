/**
 * Delete All Comment Reports Script
 *
 * Deletes ALL COMMENT_REPORT notices from the database (active and processed).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/delete_all_comment_reports.ts [--dry-run]
 */

import 'dotenv/config';

import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\nDeleting ALL COMMENT_REPORT notices (active and processed)');
  if (dryRun) {
    console.log('*** DRY RUN — no changes will be written ***\n');
  }


  let totalFound = 0;
  let totalDeleted = 0;
  let totalErrors = 0;

  console.log(`\nScanning ACTIVE notices...`);
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;
  let scanned = 0;

  while (hasMore) {
    const result = await noticeDao.getByStatus(NoticeStatus.ACTIVE, lastKey);
    const items = result.items || [];
    scanned += items.length;

    const commentReports = items.filter(
      (item: any) => item.type === NoticeType.COMMENT_REPORT
    );

    for (const notice of commentReports) {
      totalFound++;
      const subject = (notice as any).subject ?? '(none)';
      const truncated = subject.length > 80 ? subject.slice(0, 80) + '...' : subject;
      console.log(`  ${notice.id}  subject: ${truncated}`);

      if (!dryRun) {
        try {
          await noticeDao.delete(notice);
          totalDeleted++;
        } catch (err: any) {
          console.error(`  ERROR deleting ${notice.id}: ${err.message}`);
          totalErrors++;
        }
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }
  console.log(`  Scanned ${scanned} active notice(s)`);

  console.log(`\n--- Summary ---`);
  console.log(`  COMMENT_REPORT notices found: ${totalFound}`);
  console.log(`  Deleted: ${dryRun ? 0 : totalDeleted}`);
  if (totalErrors > 0) {
    console.log(`  Errors: ${totalErrors}`);
  }
  if (dryRun) {
    console.log('\n  *** DRY RUN — run without --dry-run to delete ***');
  }
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
