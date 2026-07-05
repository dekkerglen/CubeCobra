/**
 * Backfill the enumeration GSI keys onto existing PATRON and USER rows.
 *
 * Why: neither patrons nor users could be listed in bulk — patrons could only be
 * fetched by owner/email and users by id/username/email. To reconcile Patreon status
 * (and, going forward, to enumerate users/patrons cheaply) we added:
 *   - Patron GSI2: static `PATRON#ALL` partition (PatronDynamoDao.allPartitionKey())
 *   - User   GSI3: sharded `USER#SHARD#{n}` partitions (USER_ENUMERATION_SHARDS)
 *
 * The DAOs now write these keys on every put, but existing rows predate them. This
 * script sets them on the current rows.
 *
 * How: a DynamoDB *parallel* scan (Segment/TotalSegments) over the whole table with a
 * FilterExpression that keeps only PATRON and USER rows, then an UpdateCommand per row
 * that SETs the appropriate GSI keys (leaving every other attribute untouched). It is
 * idempotent — re-running writes the same keys — and resumable via a per-segment
 * checkpoint. NOTE: a filtered scan still *reads* the entire table, so this consumes
 * read capacity proportional to total item count. It is a one-time migration.
 *
 * Usage (from packages/scripts):
 *   ts-node -r tsconfig-paths/register --project tsconfig.json \
 *     src/dynamoMigrations/backfillPatronUserEnumerationGSI.ts [--dry-run] [--segments=8]
 */
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import { PatronDynamoDao } from 'dynamo/dao/PatronDynamoDao';
import { UserDynamoDao, userEnumerationShard } from 'dynamo/dao/UserDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

interface MigrationStats {
  // Total items read from the table (ScannedCount) — reflects real progress through the
  // ~202M-item table, since the FilterExpression discards all but PATRON/USER rows.
  scanned: number;
  patronsUpdated: number;
  usersUpdated: number;
  errors: number;
}

interface Checkpoint {
  // Per-segment ExclusiveStartKey; a null entry means that segment is exhausted.
  segments: Record<number, Record<string, any> | null>;
  stats: MigrationStats;
}

const CHECKPOINT_FILE = path.join(__dirname, 'backfillPatronUserEnumerationGSI.checkpoint.json');
const UPDATE_CONCURRENCY = 50;

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

  // Reused only for its key-derivation helpers; no reads/writes go through the DAO.
  const userDao = new UserDynamoDao(documentClient, tableName);
  const patronAllPK = PatronDynamoDao.allPartitionKey();

  // eslint-disable-next-line no-console
  console.log('='.repeat(80));
  // eslint-disable-next-line no-console
  console.log(`Backfill PATRON GSI2 + USER GSI3 enumeration keys`);
  // eslint-disable-next-line no-console
  console.log(`Table: ${tableName} | segments: ${totalSegments}${dryRun ? ' | *** DRY RUN ***' : ''}`);
  // eslint-disable-next-line no-console
  console.log('='.repeat(80));

  const checkpoint: Checkpoint = loadCheckpoint() || {
    segments: {},
    stats: { scanned: 0, patronsUpdated: 0, usersUpdated: 0, errors: 0 },
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
          FilterExpression: 'SK = :patron OR SK = :user',
          ExpressionAttributeValues: { ':patron': 'PATRON', ':user': 'USER' },
          ProjectionExpression: 'PK, SK',
          ExclusiveStartKey: lastKey,
        }),
      );

      const rows = res.Items || [];
      stats.scanned += res.ScannedCount || 0;

      const errors = await runChunked(rows, UPDATE_CONCURRENCY, async (row) => {
        const pk = row.PK as string;
        const sk = row.SK as string;

        let update: { pk: string; sk: string; names: Record<string, string>; values: Record<string, string> };
        if (sk === 'PATRON') {
          const owner = pk.replace('PATRON#', '');
          update = {
            pk,
            sk,
            names: { '#pk': 'GSI2PK', '#sk': 'GSI2SK' },
            values: { ':pk': patronAllPK, ':sk': owner },
          };
        } else {
          const id = pk.replace('USER#', '');
          update = {
            pk,
            sk,
            names: { '#pk': 'GSI3PK', '#sk': 'GSI3SK' },
            values: { ':pk': userDao.shardPartitionKey(userEnumerationShard(id)), ':sk': id },
          };
        }

        if (!dryRun) {
          await documentClient.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: update.pk, SK: update.sk },
              UpdateExpression: 'SET #pk = :pk, #sk = :sk',
              ExpressionAttributeNames: update.names,
              ExpressionAttributeValues: update.values,
            }),
          );
        }

        if (sk === 'PATRON') {
          stats.patronsUpdated += 1;
        } else {
          stats.usersUpdated += 1;
        }
      });
      stats.errors += errors;

      lastKey = res.LastEvaluatedKey;
      checkpoint.segments[segment] = lastKey || null;
      saveCheckpoint(checkpoint);

      // eslint-disable-next-line no-console
      console.log(
        `[seg ${segment}] scanned=${stats.scanned} patrons=${stats.patronsUpdated} users=${stats.usersUpdated} errors=${stats.errors}${lastKey ? '' : ' (segment done)'}`,
      );
    } while (lastKey);
  };

  // Run the segments concurrently — this is what makes it a parallel scan.
  await Promise.all(Array.from({ length: totalSegments }, (_, segment) => processSegment(segment)));

  // eslint-disable-next-line no-console
  console.log('='.repeat(80));
  // eslint-disable-next-line no-console
  console.log(
    `Done. scanned=${stats.scanned} patronsUpdated=${stats.patronsUpdated} usersUpdated=${stats.usersUpdated} errors=${stats.errors}${dryRun ? ' (DRY RUN — no writes)' : ''}`,
  );
  // eslint-disable-next-line no-console
  console.log('='.repeat(80));

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
