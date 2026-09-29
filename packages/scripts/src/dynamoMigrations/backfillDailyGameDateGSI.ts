/**
 * Backfill the per-date GSI2 keys onto existing daily-game submission rows.
 *
 * Why: the three daily games key one submission row per user per puzzle date, with GSI1 on
 * `<ITEMTYPE>#USER#{userId}` — which answers "one player's history" but not "everyone who
 * played on 2026-09-28". The admin daily-games funnel needs the latter, so the submission
 * DAOs now also write:
 *
 *   MANAMATRIX_SUBMISSION      GSI2: `MANAMATRIX_SUBMISSION#DATE#{date}`      / `USER#{userId}`
 *   SYNERGY_CONNECT_SUBMISSION GSI2: `SYNERGY_CONNECT_SUBMISSION#DATE#{date}` / `USER#{userId}`
 *   CROSSWORD_SUBMISSION       GSI2: `CROSSWORD_SUBMISSION#DATE#{date}`       / `USER#{userId}`
 *
 * GSI2 was previously unused on all three, so this needed no new index and no table change —
 * but a DynamoDB GSI is sparse: it only carries items whose index keys were present when the
 * item was *written*. Rows written before this deploy are therefore invisible to the
 * dashboard until they are rewritten.
 *
 * You may not need this script. `BaseDynamoDao.update()` re-puts the whole item (GSI keys
 * recomputed from `GSIKeys()`), and every submit / guess / check on a puzzle goes through
 * `update()`. So any puzzle date still being played heals itself, and only dates that were
 * already finished at deploy time stay dark. Run this if the dashboard's history matters.
 *
 * How: a DynamoDB *parallel* scan (Segment/TotalSegments) over the table, filtered to the
 * three submission SKs, then an UpdateCommand per row that SETs GSI2PK/GSI2SK and touches
 * nothing else. Idempotent — re-running writes the same keys — and resumable via a
 * per-segment checkpoint.
 *
 * COST, stated plainly: a filtered scan still *reads the whole table*, and this table holds
 * on the order of 10^8 items. The filter only saves the network transfer, not the read
 * capacity. This is a one-time migration for a few thousand rows of interest; run it
 * deliberately, off-peak, and prefer `--dry-run` first. The alternative — enumerating every
 * user and GetItem-ing every (user, date) pair — is worse, because the user table is far
 * larger than the set of people who have played a daily game.
 *
 * `date` and `userId` are recovered from the primary key (`<ITEMTYPE>#{userId}#{date}`)
 * rather than from the item body, so the projection stays keys-only.
 *
 * Usage (from packages/scripts):
 *   ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/dynamoMigrations/backfillDailyGameDateGSI.ts [--dry-run] [--segments=8]
 */
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

// SK values to migrate. Each is its own item type, and its GSI2PK is namespaced by it, so
// the three games' days never collide in one partition.
const ITEM_TYPES = ['MANAMATRIX_SUBMISSION', 'SYNERGY_CONNECT_SUBMISSION', 'CROSSWORD_SUBMISSION'] as const;

const CHECKPOINT_FILE = path.join(__dirname, 'backfillDailyGameDateGSI.checkpoint.json');
const UPDATE_CONCURRENCY = 50;

interface MigrationStats {
  // ScannedCount, i.e. real progress through the table — the filter discards most of it.
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface Checkpoint {
  // Per-segment ExclusiveStartKey; a null entry means that segment is exhausted.
  segments: Record<number, Record<string, any> | null>;
  stats: MigrationStats;
}

const saveCheckpoint = (checkpoint: Checkpoint): void => {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
};

const loadCheckpoint = (): Checkpoint | null => {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading checkpoint:', error);
  }
  return null;
};

const clearCheckpoint = (): void => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
};

/**
 * Splits `<ITEMTYPE>#{userId}#{date}` back into its parts.
 *
 * The date is the trailing YYYY-MM-DD, taken from the end rather than by splitting on '#',
 * because a userId is a uuid but nothing in the key format guarantees it never contains one.
 */
const parseSubmissionKey = (pk: string, itemType: string): { userId: string; date: string } | null => {
  const prefix = `${itemType}#`;
  if (!pk.startsWith(prefix)) {
    return null;
  }
  const rest = pk.slice(prefix.length);
  const match = rest.match(/^(.+)#(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    return null;
  }
  return { userId: match[1]!, date: match[2]! };
};

const runChunked = async <I>(items: I[], size: number, fn: (item: I) => Promise<void>): Promise<number> => {
  let errors = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.allSettled(items.slice(i, i + size).map(fn));
    errors += results.filter((r) => r.status === 'rejected').length;
  }
  return errors;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const segmentsArg = args.find((a) => a.startsWith('--segments='));
  const totalSegments = segmentsArg ? Math.max(1, parseInt(segmentsArg.split('=')[1] || '8', 10)) : 8;

  const tableName = process.env.DYNAMO_TABLE;
  if (!tableName) {
    throw new Error('DYNAMO_TABLE must be a defined environment variable');
  }

  const skNames = Object.fromEntries(ITEM_TYPES.map((type, i) => [`:sk${i}`, type]));
  const skFilter = ITEM_TYPES.map((_, i) => `SK = :sk${i}`).join(' OR ');

  /* eslint-disable no-console */
  console.log('='.repeat(80));
  console.log('Backfill daily-game submission GSI2 (per-puzzle-date) keys');
  console.log(`Table: ${tableName} | segments: ${totalSegments}${dryRun ? ' | *** DRY RUN ***' : ''}`);
  console.log(`Item types: ${ITEM_TYPES.join(', ')}`);
  console.log('='.repeat(80));
  /* eslint-enable no-console */

  const checkpoint: Checkpoint = loadCheckpoint() || {
    segments: {},
    stats: { scanned: 0, updated: 0, skipped: 0, errors: 0 },
  };
  const stats = checkpoint.stats;

  const processSegment = async (segment: number): Promise<void> => {
    // A null checkpoint entry means this segment already finished on a prior run.
    if (checkpoint.segments[segment] === null) {
      return;
    }
    let lastKey: Record<string, any> | undefined = checkpoint.segments[segment] || undefined;

    do {
      const res = await documentClient.send(
        new ScanCommand({
          TableName: tableName,
          Segment: segment,
          TotalSegments: totalSegments,
          FilterExpression: skFilter,
          ExpressionAttributeValues: skNames,
          ProjectionExpression: 'PK, SK',
          ExclusiveStartKey: lastKey,
        }),
      );

      const rows = res.Items || [];
      stats.scanned += res.ScannedCount || 0;

      const errors = await runChunked(rows, UPDATE_CONCURRENCY, async (row) => {
        const pk = row.PK as string;
        const sk = row.SK as string;

        const parsed = parseSubmissionKey(pk, sk);
        if (!parsed) {
          // An unexpected key shape. Left alone rather than guessed at — a wrong GSI2PK would
          // file a player under the wrong day, which is worse than filing them under none.
          stats.skipped += 1;
          // eslint-disable-next-line no-console
          console.warn(`Skipping unparseable key: ${pk}`);
          return;
        }

        if (!dryRun) {
          await documentClient.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: pk, SK: sk },
              UpdateExpression: 'SET #pk = :pk, #sk = :sk',
              ExpressionAttributeNames: { '#pk': 'GSI2PK', '#sk': 'GSI2SK' },
              ExpressionAttributeValues: {
                ':pk': `${sk}#DATE#${parsed.date}`,
                ':sk': `USER#${parsed.userId}`,
              },
              // Only touch rows that still exist. Deliberately does *not* bump DynamoVersion:
              // this adds index keys the DAO would have written anyway and changes no
              // attribute any writer owns, so leaving the version alone keeps a concurrent
              // optimistic update from failing because of the migration.
              ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
            }),
          );
        }

        stats.updated += 1;
      });
      stats.errors += errors;

      lastKey = res.LastEvaluatedKey;
      checkpoint.segments[segment] = lastKey || null;
      saveCheckpoint(checkpoint);

      // eslint-disable-next-line no-console
      console.log(
        `[seg ${segment}] scanned=${stats.scanned} updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors}${lastKey ? '' : ' (segment done)'}`,
      );
    } while (lastKey);
  };

  // Run the segments concurrently — this is what makes it a parallel scan.
  await Promise.all(Array.from({ length: totalSegments }, (_, segment) => processSegment(segment)));

  /* eslint-disable no-console */
  console.log('='.repeat(80));
  console.log(
    `Done. scanned=${stats.scanned} updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors}${dryRun ? ' (DRY RUN — no writes)' : ''}`,
  );
  console.log('='.repeat(80));
  /* eslint-enable no-console */

  if (stats.errors === 0) {
    clearCheckpoint();
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Backfill failed (checkpoint preserved, safe to re-run):', err);
    process.exit(1);
  });
