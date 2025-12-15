// Load Environment Variables
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
// Configure dotenv with explicit path to scripts package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'scripts', '.env') });

import documentClient from '@server/dynamo/documentClient';
import * as fs from 'fs';

// Import commands from the server package to avoid version mismatches
 
const { ScanCommand, BatchWriteCommand } = require('../../server/node_modules/@aws-sdk/lib-dynamodb');

interface OldHashRow {
  PK: string;
  SK: string;
}

interface Stats {
  scanned: number;
  oldFormatFound: number;
  deleted: number;
  errors: number;
}

interface Checkpoint {
  lastKey?: Record<string, any>;
  stats: Stats;
  timestamp: number;
}

const CHECKPOINT_FILE = path.join(__dirname, '..', 'temp', 'purge-hash-checkpoint.json');

/**
 * Saves checkpoint to disk
 */
function saveCheckpoint(lastKey: Record<string, any> | undefined, stats: Stats): void {
  const checkpoint: Checkpoint = {
    lastKey,
    stats,
    timestamp: Date.now(),
  };

  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  console.log(`Checkpoint saved: ${stats.scanned} scanned, ${stats.deleted} deleted`);
}

/**
 * Loads checkpoint from disk
 */
function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    const checkpoint = JSON.parse(data) as Checkpoint;
    console.log(
      `Checkpoint loaded from ${new Date(checkpoint.timestamp).toISOString()}: ${checkpoint.stats.scanned} scanned, ${checkpoint.stats.deleted} deleted`,
    );
    return checkpoint;
  } catch (err: any) {
    console.error(`Failed to load checkpoint: ${err.message}`);
    return null;
  }
}

/**
 * Deletes checkpoint file
 */
function deleteCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('Checkpoint deleted');
  }
}

/**
 * Scans the DynamoDB table and deletes old format hash rows.
 */
async function purgeOldFormatHashRows(): Promise<void> {
  const tableName = process.env.DYNAMO_TABLE || 'PROD_CUBECOBRA';

  console.log(`Starting purge of old format hash rows from table: ${tableName}`);
  console.log('Old format: PK=hash, SK=CUBE#{id}');
  console.log('New format: PK=HASH#CUBE#{id}, SK=hash');
  console.log('');

  // Try to load checkpoint
  const checkpoint = loadCheckpoint();
  const stats: Stats = checkpoint?.stats || {
    scanned: 0,
    oldFormatFound: 0,
    deleted: 0,
    errors: 0,
  };

  let lastKey: Record<string, any> | undefined = checkpoint?.lastKey;
  let segmentNumber = 0;
  const BATCH_SIZE = 25; // DynamoDB batch write limit
  const CHECKPOINT_INTERVAL = 10; // Save checkpoint every N segments

  if (checkpoint) {
    console.log('Resuming from checkpoint...\n');
  }

  try {
    do {
      segmentNumber++;
      const segmentStartTime = Date.now();

      // Scan a segment of the table
      // Filter for old format hash rows: SK starts with "CUBE#"
      const scanResult = await documentClient.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey: lastKey,
          FilterExpression: 'begins_with(SK, :cubePrefix)',
          ExpressionAttributeValues: {
            ':cubePrefix': 'CUBE#',
          },
        }),
      );

      const items = scanResult.Items || [];
      stats.scanned += items.length;

      // Further filter for old format: PK must be a 64-char hex hash
      const oldFormatRows: OldHashRow[] = items
        .filter((item: any) => {
          const pk = item.PK as string;
          return /^[0-9a-f]{64}$/i.test(pk);
        })
        .map((item: any) => ({
          PK: item.PK,
          SK: item.SK,
        }));

      stats.oldFormatFound += oldFormatRows.length;

      if (oldFormatRows.length > 0) {
        // Delete in batches of up to 25 items
        for (let i = 0; i < oldFormatRows.length; i += BATCH_SIZE) {
          const batch = oldFormatRows.slice(i, i + BATCH_SIZE);

          try {
            await documentClient.send(
              new BatchWriteCommand({
                RequestItems: {
                  [tableName]: batch.map((row) => ({
                    DeleteRequest: {
                      Key: {
                        PK: row.PK,
                        SK: row.SK,
                      },
                    },
                  })),
                },
              }),
            );

            stats.deleted += batch.length;
          } catch (err: any) {
            console.error(`Error deleting batch: ${err.message}`);
            stats.errors += batch.length;
          }
        }
      }

      const segmentDuration = ((Date.now() - segmentStartTime) / 1000).toFixed(2);

      // Save checkpoint periodically
      if (segmentNumber % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(lastKey, stats);
        console.log(`\n=== Checkpoint ${segmentNumber} ===`);
        console.log(`Total scanned: ${stats.scanned}`);
        console.log(`Old format found: ${stats.oldFormatFound}`);
        console.log(`Deleted: ${stats.deleted}`);
        console.log(`Errors: ${stats.errors}\n`);
      }

      lastKey = scanResult.LastEvaluatedKey;
    } while (lastKey);

    // Delete checkpoint on successful completion
    deleteCheckpoint();

    console.log('\n=== Purge Complete ===');
    console.log(`Total items scanned: ${stats.scanned}`);
    console.log(`Old format hash rows found: ${stats.oldFormatFound}`);
    console.log(`Successfully deleted: ${stats.deleted}`);
    console.log(`Errors: ${stats.errors}`);

    if (stats.errors > 0) {
      console.error(`\nWarning: ${stats.errors} rows failed to delete. Check logs above for details.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during purge:', err);
    // Save checkpoint on error so we can resume
    saveCheckpoint(lastKey, stats);
    console.error('Checkpoint saved. You can resume by running the script again.');
    process.exit(1);
  }

  process.exit(0);
}

// Check for dry-run mode
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log('DRY RUN MODE - Will only identify old format hash rows without deleting them\n');

  (async () => {
    const tableName = process.env.DYNAMO_TABLE || 'PROD_CUBECOBRA';
    console.log(`Scanning table: ${tableName}\n`);

    let lastKey: Record<string, any> | undefined = undefined;
    let scanned = 0;
    let oldFormatFound = 0;
    const samples: any[] = [];

    do {
      const scanResult = await documentClient.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey: lastKey,
          FilterExpression: 'begins_with(SK, :cubePrefix)',
          ExpressionAttributeValues: {
            ':cubePrefix': 'CUBE#',
          },
        }),
      );

      const items = scanResult.Items || [];
      scanned += items.length;

      for (const item of items) {
        const pk = item.PK as string;
        // Check if PK is a 64-char hex hash (old format)
        if (/^[0-9a-f]{64}$/i.test(pk)) {
          oldFormatFound++;
          if (samples.length < 5) {
            samples.push({ PK: item.PK, SK: item.SK });
          }
        }
      }

      if (scanned % 10000 === 0) {
        console.log(`Scanned: ${scanned}, Old format found: ${oldFormatFound}`);
      }

      lastKey = scanResult.LastEvaluatedKey;
    } while (lastKey);

    console.log('\n=== Dry Run Complete ===');
    console.log(`Total items scanned: ${scanned}`);
    console.log(`Old format hash rows found: ${oldFormatFound}`);

    if (samples.length > 0) {
      console.log('\nSample old format rows:');
      samples.forEach((sample, i) => {
        console.log(`${i + 1}. PK: ${sample.PK}, SK: ${sample.SK}`);
      });
    }

    console.log('\nTo actually delete these rows, run without --dry-run flag');
    process.exit(0);
  })();
} else {
  purgeOldFormatHashRows();
}
