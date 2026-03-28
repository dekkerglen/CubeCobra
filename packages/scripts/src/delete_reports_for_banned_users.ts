/**
 * Delete User Reports for Banned Users
 *
 * Deletes all CUBE_REPORT notices (user reports) where the reported user is already banned.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/delete_reports_for_banned_users.ts [--dry-run]
 */

import 'dotenv/config';

import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { UserRoles } from '@utils/datatypes/User';
import { noticeDao, userDao } from 'dynamo/daos';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\nDeleting all CUBE_REPORT notices for users who are already banned');
  if (dryRun) {
    console.log('*** DRY RUN — no changes will be written ***\n');
  }

  let totalFound = 0;
  let totalDeleted = 0;
  let totalErrors = 0;
  let bannedCache = new Map<string, boolean>();

  console.log(`\nScanning ACTIVE notices...`);
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;
  let scanned = 0;

  while (hasMore) {
    const result = await noticeDao.getByStatus(NoticeStatus.ACTIVE, lastKey);
    const items = result.items || [];
    scanned += items.length;

    const userReports = items.filter(
      (item: any) => item.type === NoticeType.CUBE_REPORT && item.subject
    );

    for (const notice of userReports) {
      const userId = String(notice.subject);
      if (!userId) continue;

      let isBanned = bannedCache.get(userId);
      if (isBanned === undefined) {
        try {
          const user = await userDao.getById(userId);
          isBanned = !!user && !!(user.roles && user.roles.includes(UserRoles.BANNED));
          bannedCache.set(userId, isBanned);
        } catch (err: any) {
          console.error(`  ERROR fetching user ${userId}: ${err.message}`);
          totalErrors++;
          continue;
        }
      }
      if (!isBanned) continue;

      totalFound++;
      console.log(`  Deleting report ${notice.id} for banned user ${userId}`);
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
  console.log(`  User reports for banned users found: ${totalFound}`);
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
