/**
 * Delete Comment Reports Script
 *
 * Deletes all COMMENT_REPORT notices targeting a specific comment ID.
 * Scans both ACTIVE and PROCESSED notices to catch everything.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/delete_comment_reports.ts --comment <commentId> [--dry-run]
 */

import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

async function main() {
  const args = process.argv.slice(2);

  let commentId: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--comment' && args[i + 1]) {
      commentId = args[i + 1];
      i += 1;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (!commentId) {
    console.error('Usage: delete_comment_reports.ts --comment <commentId> [--dry-run]');
    process.exit(1);
  }

  console.log(`\nDeleting all COMMENT_REPORT notices for comment: ${commentId}`);
  if (dryRun) {
    console.log('*** DRY RUN — no changes will be written ***\n');
  }

  const statuses = [NoticeStatus.ACTIVE, NoticeStatus.PROCESSED];
  let totalFound = 0;
  let totalDeleted = 0;
  let totalErrors = 0;

  for (const status of statuses) {
    console.log(`\nScanning ${status === NoticeStatus.ACTIVE ? 'ACTIVE' : 'PROCESSED'} notices...`);

    let lastKey: Record<string, NativeAttributeValue> | undefined;
    let hasMore = true;
    let scanned = 0;

    while (hasMore) {
      const result = await noticeDao.getByStatus(status, lastKey);
      const items = result.items || [];
      scanned += items.length;

      const matches = items.filter(
        (item: any) => item.type === NoticeType.COMMENT_REPORT && item.subject === commentId,
      );

      for (const notice of matches) {
        totalFound += 1;
        console.log(
          `  Found report: ${notice.id} (date: ${new Date(notice.date).toISOString()}, user: ${typeof notice.user === 'object' ? notice.user?.username || notice.user?.id : notice.user})`,
        );

        if (!dryRun) {
          try {
            await noticeDao.delete(notice);
            totalDeleted += 1;
          } catch (err: any) {
            console.error(`  ERROR deleting ${notice.id}: ${err.message}`);
            totalErrors += 1;
          }
        }
      }

      lastKey = result.lastKey;
      hasMore = !!lastKey;
    }

    console.log(`  Scanned ${scanned} ${status === NoticeStatus.ACTIVE ? 'active' : 'processed'} notice(s)`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Comment ID: ${commentId}`);
  console.log(`  Reports found: ${totalFound}`);
  console.log(`  Reports deleted: ${dryRun ? 0 : totalDeleted}`);
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
