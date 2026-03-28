/**
 * Deduplicate User Reports
 *
 * Deletes duplicate active CUBE_REPORT notices so only one report per
 * reported user remains (the most recent one is kept).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/dedup_user_reports.ts [--dry-run]
 */

import 'dotenv/config';

import { NoticeStatus, NoticeType } from '@utils/datatypes/Notice';
import { Notice } from '@utils/datatypes/Notice';
import { noticeDao } from 'dynamo/daos';
import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\nDeduplicating active CUBE_REPORT notices (keeping most recent per user)');
  if (dryRun) {
    console.log('*** DRY RUN — no changes will be written ***\n');
  }

  // Collect all active user reports
  const allReports: Notice[] = [];
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  let hasMore = true;
  let scanned = 0;

  console.log('\nScanning ACTIVE notices...');
  while (hasMore) {
    const result = await noticeDao.getByStatus(NoticeStatus.ACTIVE, lastKey);
    const items = result.items || [];
    scanned += items.length;

    for (const item of items) {
      if ((item as any).type === NoticeType.CUBE_REPORT && (item as any).subject) {
        allReports.push(item);
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }
  console.log(`  Scanned ${scanned} active notice(s), found ${allReports.length} CUBE_REPORT(s)`);

  // Group by subject (reported user ID)
  const bySubject = new Map<string, Notice[]>();
  for (const report of allReports) {
    const subject = String((report as any).subject);
    if (!bySubject.has(subject)) {
      bySubject.set(subject, []);
    }
    bySubject.get(subject)!.push(report);
  }

  let totalDuplicates = 0;
  let totalDeleted = 0;
  let totalErrors = 0;

  for (const [subject, reports] of bySubject.entries()) {
    if (reports.length <= 1) continue;

    // Sort by date descending — keep the newest
    reports.sort((a, b) => b.date - a.date);
    const keep = reports[0]!;
    const dupes = reports.slice(1);

    console.log(`\n  User ${subject}: ${reports.length} report(s), keeping ${keep.id} (${new Date(keep.date).toISOString()})`);

    for (const dupe of dupes) {
      totalDuplicates++;
      console.log(`    Deleting ${dupe.id} (${new Date(dupe.date).toISOString()})`);

      if (!dryRun) {
        try {
          await noticeDao.delete(dupe);
          totalDeleted++;
        } catch (err: any) {
          console.error(`    ERROR deleting ${dupe.id}: ${err.message}`);
          totalErrors++;
        }
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Unique reported users: ${bySubject.size}`);
  console.log(`  Duplicate reports found: ${totalDuplicates}`);
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
