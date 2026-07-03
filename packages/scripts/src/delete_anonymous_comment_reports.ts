/**
 * Delete Anonymous Comment Reports
 *
 * Deletes all COMMENT_REPORT notices that were submitted anonymously (no
 * authenticated user attached). The `/comment/report` route historically did
 * not require authentication, which let bots flood the moderation queue with
 * spam/SQL-injection reports carrying valid comment IDs but garbage reason text.
 *
 * A notice is considered anonymous when its stored `user` is null. After
 * hydration the NoticeDao substitutes an anonymous placeholder user with
 * id '404' / username 'Anonymous', so we match on that here.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/delete_anonymous_comment_reports.ts [--dry-run]
 */

import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';
import { Notice, NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';

import 'dotenv/config';

function isAnonymous(notice: Notice): boolean {
  // Hydration maps a null stored user to the anonymous placeholder (id '404').
  return !notice.user || notice.user.id === '404' || notice.user.username === 'Anonymous';
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\nDeleting anonymous COMMENT_REPORT notices (active and processed)');
  if (dryRun) {
    console.log('*** DRY RUN — no changes will be written ***\n');
  }

  const statuses = [NoticeStatus.ACTIVE, NoticeStatus.PROCESSED];
  let totalFound = 0;
  let totalDeleted = 0;
  let totalErrors = 0;

  for (const status of statuses) {
    const label = status === NoticeStatus.ACTIVE ? 'ACTIVE' : 'PROCESSED';
    console.log(`\nScanning ${label} notices...`);

    let lastKey: Record<string, NativeAttributeValue> | undefined;
    let hasMore = true;
    let scanned = 0;

    while (hasMore) {
      const result = await noticeDao.getByStatus(status, lastKey);
      const items = result.items || [];
      scanned += items.length;

      const anonymousReports = items.filter(
        (item) => item.type === NoticeType.COMMENT_REPORT && isAnonymous(item),
      );

      for (const notice of anonymousReports) {
        totalFound += 1;
        const subject = notice.subject ?? '(none)';
        const reason = (notice.body ?? '').split('\n')[0] ?? '';
        const truncated = reason.length > 80 ? reason.slice(0, 80) + '...' : reason;
        console.log(`  ${notice.id}  subject: ${subject}  reason: ${truncated}`);

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

    console.log(`  Scanned ${scanned} ${label.toLowerCase()} notice(s)`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Anonymous comment reports found: ${totalFound}`);
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
