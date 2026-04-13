/**
 * Backfill script to update dateLastUpdated for all cubes to the date of their most recent changelog.
 *
 * Problem: Some cubes have incorrect dateLastUpdated values due to non-owner actions (follows,
 * playtest drafts, etc.) historically bumping the timestamp before skipTimestampUpdate guards
 * were added. This script corrects dateLastUpdated by setting it to the date of the most recent
 * changelog entry for each cube.
 *
 * What it does for each cube:
 *   1. Queries the most recent changelog entry via GSI1 (CHANGELOG#CUBE#{cubeId}, sorted by date desc)
 *   2. If a changelog exists, updates the cube's:
 *      - item.dateLastUpdated (nested attribute)
 *      - item.date (legacy field, kept in sync)
 *      - GSI1SK (top-level GSI key used for owner+date queries)
 *   3. If no changelog exists, the cube is skipped (left unchanged)
 *
 * Usage:
 *   - Full migration: ts-node -r tsconfig-paths/register --project tsconfig.json src/dynamoMigrations/backfillDateLastUpdated.ts
 *   - Test mode (single cube): ... -- --test-cube=<cubeId>
 *   - Dry run: ... -- --dry-run
 *
 * Supports resumability via checkpoint file.
 */

import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  updated: number;
  skippedNoChangelog: number;
  skippedAlreadyCorrect: number;
  errors: number;
}

interface Checkpoint {
  lastScanKey?: Record<string, any>;
  stats: MigrationStats;
}

const CHECKPOINT_FILE = path.join(__dirname, 'backfillDateLastUpdated.checkpoint.json');
const BATCH_SIZE = 25;

function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading checkpoint:', error);
  }
  return null;
}

function clearCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch (error) {
    console.error('Error clearing checkpoint:', error);
  }
}

async function updateCubeDateLastUpdated(
  tableName: string,
  cubeId: string,
  newDate: number,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    return;
  }

  await documentClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `CUBE#${cubeId}`,
        SK: 'CUBE',
      },
      UpdateExpression: 'SET #gsi1sk = :gsi1sk, #item.#dateLastUpdated = :newDate, #item.#date = :newDate',
      ExpressionAttributeNames: {
        '#gsi1sk': 'GSI1SK',
        '#item': 'item',
        '#dateLastUpdated': 'dateLastUpdated',
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':gsi1sk': `DATE#${newDate}`,
        ':newDate': newDate,
      },
    }),
  );
}

async function scanCubes(
  tableName: string,
  lastKey?: Record<string, any>,
): Promise<{ items: Array<{ cubeId: string; currentDate?: number }>; lastKey?: Record<string, any> }> {
  const result = await documentClient.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'CUBE#',
        ':sk': 'CUBE',
      },
      ProjectionExpression: 'PK, #item.#dateLastUpdated',
      ExpressionAttributeNames: {
        '#item': 'item',
        '#dateLastUpdated': 'dateLastUpdated',
      },
      ExclusiveStartKey: lastKey,
    }),
  );

  const items = (result.Items || []).map((dynamoItem) => ({
    cubeId: (dynamoItem.PK as string).replace('CUBE#', ''),
    currentDate: dynamoItem.item?.dateLastUpdated as number | undefined,
  }));

  return {
    items,
    lastKey: result.LastEvaluatedKey,
  };
}

(async () => {
  try {
    const args = process.argv.slice(2);
    const testCubeArg = args.find((arg) => arg.startsWith('--test-cube='));
    const testCubeId = testCubeArg ? testCubeArg.split('=')[1] : null;
    const dryRun = args.includes('--dry-run');

    const tableName = process.env.DYNAMO_TABLE;
    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    const changelogDao = new ChangelogDynamoDao(documentClient, tableName);

    console.log('='.repeat(80));
    console.log('Backfill dateLastUpdated from most recent changelog');
    console.log(`Target table: ${tableName}`);
    if (dryRun) {
      console.log('*** DRY RUN MODE - no writes will be performed ***');
    }
    console.log('='.repeat(80));

    // TEST MODE: Process a single cube
    if (testCubeId) {
      console.log(`\nTEST MODE: Processing single cube: ${testCubeId}`);

      const changelogResult = await changelogDao.queryByCube(testCubeId, undefined, 1);
      const latestChangelog = changelogResult.items[0];

      if (!latestChangelog) {
        console.log(`  No changelogs found for cube ${testCubeId} - nothing to update`);
        process.exit(0);
      }

      console.log(`  Latest changelog date: ${latestChangelog.date} (${new Date(latestChangelog.date).toISOString()})`);
      console.log(`  Changelog ID: ${latestChangelog.id}`);

      if (!dryRun) {
        await updateCubeDateLastUpdated(tableName, testCubeId, latestChangelog.date);
        console.log(`  ✓ Updated dateLastUpdated to ${latestChangelog.date}`);
      } else {
        console.log(`  [DRY RUN] Would update dateLastUpdated to ${latestChangelog.date}`);
      }

      process.exit(0);
    }

    // FULL MIGRATION MODE
    const checkpoint = loadCheckpoint();
    const stats: MigrationStats = checkpoint?.stats || {
      total: 0,
      updated: 0,
      skippedNoChangelog: 0,
      skippedAlreadyCorrect: 0,
      errors: 0,
    };

    let lastScanKey: Record<string, any> | undefined = checkpoint?.lastScanKey;

    if (checkpoint) {
      console.log(`Resuming from checkpoint:`);
      console.log(`  Total processed so far: ${stats.total}`);
      console.log(`  Updated: ${stats.updated}`);
      console.log(`  Skipped (no changelog): ${stats.skippedNoChangelog}`);
      console.log(`  Skipped (already correct): ${stats.skippedAlreadyCorrect}`);
      console.log(`  Errors: ${stats.errors}`);
      console.log('='.repeat(80));
    }

    console.log('\nScanning cubes and backfilling dateLastUpdated...');
    let scanBatch = 0;

    do {
      scanBatch += 1;
      console.log(`\nScan batch ${scanBatch}:`);

      const scanResult = await scanCubes(tableName, lastScanKey);

      if (scanResult.items.length === 0) {
        console.log('  No cubes found in this batch');
        lastScanKey = scanResult.lastKey;
        continue;
      }

      console.log(`  Found ${scanResult.items.length} cubes to process`);
      stats.total += scanResult.items.length;

      // Process cubes in parallel batches
      for (let i = 0; i < scanResult.items.length; i += BATCH_SIZE) {
        const batch = scanResult.items.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(scanResult.items.length / BATCH_SIZE);

        console.log(
          `  Processing batch ${batchNumber}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, scanResult.items.length)} of ${scanResult.items.length}):`,
        );

        const batchResults = await Promise.allSettled(
          batch.map(async ({ cubeId, currentDate }) => {
            // Query the most recent changelog for this cube
            const changelogResult = await changelogDao.queryByCube(cubeId, undefined, 1);
            const latestChangelog = changelogResult.items[0];

            if (!latestChangelog) {
              return { cubeId, action: 'skipped-no-changelog' as const };
            }

            const newDate = latestChangelog.date;

            // Skip if already correct
            if (currentDate === newDate) {
              return { cubeId, action: 'skipped-already-correct' as const };
            }

            await updateCubeDateLastUpdated(tableName, cubeId, newDate, dryRun);

            return {
              cubeId,
              action: 'updated' as const,
              oldDate: currentDate,
              newDate,
            };
          }),
        );

        // Process results
        let batchErrors = 0;
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const value = result.value;
            switch (value.action) {
              case 'updated':
                stats.updated += 1;
                console.log(
                  `    ✓ ${value.cubeId}: ${value.oldDate ? new Date(value.oldDate).toISOString() : 'none'} → ${new Date(value.newDate!).toISOString()}${dryRun ? ' [DRY RUN]' : ''}`,
                );
                break;
              case 'skipped-no-changelog':
                stats.skippedNoChangelog += 1;
                break;
              case 'skipped-already-correct':
                stats.skippedAlreadyCorrect += 1;
                break;
            }
          } else {
            stats.errors += 1;
            batchErrors += 1;
            const reason = result.reason;
            console.error(`    ❌ ${reason?.cubeId || 'unknown'}: ${reason?.message || reason}`);
          }
        }

        if (batchErrors > BATCH_SIZE / 2) {
          throw new Error(`Batch had ${batchErrors}/${BATCH_SIZE} errors, stopping migration`);
        }
      }

      lastScanKey = scanResult.lastKey;

      console.log(
        `  Scan batch ${scanBatch} complete: ${stats.updated} updated, ${stats.skippedNoChangelog} no changelog, ${stats.skippedAlreadyCorrect} already correct, ${stats.errors} errors (${stats.total} total)`,
      );

      // Save checkpoint after each scan page
      saveCheckpoint({ lastScanKey, stats });
    } while (lastScanKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total cubes scanned: ${stats.total}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped (no changelog): ${stats.skippedNoChangelog}`);
    console.log(`Skipped (already correct): ${stats.skippedAlreadyCorrect}`);
    console.log(`Errors: ${stats.errors}`);
    if (dryRun) {
      console.log('*** This was a DRY RUN - no writes were performed ***');
    }
    console.log('='.repeat(80));

    clearCheckpoint();
    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    console.error('\nCheckpoint saved. You can resume by running the script again.');
    process.exit(1);
  }
})();
