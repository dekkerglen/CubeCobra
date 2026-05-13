/**
 * Delete Invalid Comment Reports
 *
 * Deletes all COMMENT_REPORT notices where the subject field is not a valid UUID.
 * Targets SQL injection attempts and other malformed report spam.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/delete_invalid_comment_reports.ts [--dry-run]
 */

import 'dotenv/config';

import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONGO_ID_RE = /^[0-9a-f]{24}$/i;

function isValidId(subject: string): boolean {
  return UUID_RE.test(subject) || MONGO_ID_RE.test(subject);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\nDeleting COMMENT_REPORT notices with invalid (non-UUID) subjects');
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

      const invalid = items.filter(
        (item: any) => item.type === NoticeType.COMMENT_REPORT && (!item.subject || !isValidId(item.subject)),
      );

      for (const notice of invalid) {
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

    console.log(`  Scanned ${scanned} ${label.toLowerCase()} notice(s)`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Invalid comment reports found: ${totalFound}`);
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
