// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

import { ScanCommand, ScanCommandInput } from '../../../server/node_modules/@aws-sdk/lib-dynamodb';

interface MigrationStats {
  total: number;
  updated: number;
  errors: number;
  skipped: number;
}

interface Checkpoint {
  lastKey?: Record<string, any>;
  stats: MigrationStats;
  batchNumber: number;
  timestamp: number;
}

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'updateChangelogGSI2-checkpoint.json');
const BATCH_SIZE = 100; // Process items in batches

/**
 * Saves checkpoint to disk
 */
const saveCheckpoint = (checkpoint: Checkpoint): void => {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
};

/**
 * Loads checkpoint from disk
 */
const loadCheckpoint = (): Checkpoint | null => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const checkpoint = JSON.parse(data) as Checkpoint;
      console.log(`Resuming from checkpoint: batch ${checkpoint.batchNumber}, ${checkpoint.stats.updated} updated`);
      return checkpoint;
    } catch (error) {
      console.error('Error loading checkpoint:', error);
      return null;
    }
  }
  return null;
};

/**
 * Deletes checkpoint file
 */
const deleteCheckpoint = (): void => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('Checkpoint file deleted');
  }
};

/**
 * Migration script to update existing changelog items with GSI2 keys.
 *
 * This script scans the DynamoDB table for all CHANGELOG items and updates them
 * to populate the GSI2PK and GSI2SK fields for day-based querying.
 *
 * GSI2PK: CHANGELOG#DAY#YYYY-MM-DD (with properly padded dates)
 * GSI2SK: CHANGELOG#{id}
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to updateChangelogGSI2-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting changelog GSI2 update migration');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAO
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);

    // Load checkpoint if it exists
    const checkpoint = loadCheckpoint();

    const stats: MigrationStats = checkpoint?.stats || {
      total: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
    };

    let lastKey: Record<string, any> | undefined = checkpoint?.lastKey;
    let batchNumber = checkpoint?.batchNumber || 0;

    if (checkpoint) {
      console.log('Resuming from previous checkpoint...');
      console.log(`Previous stats: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`);
    }

    do {
      batchNumber += 1;

      // Scan the table with filter for CHANGELOG items
      const scanParams: ScanCommandInput = {
        TableName: tableName,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':pk': 'CHANGELOG#',
        },
        ExclusiveStartKey: lastKey,
      };

      const scanResult = await documentClient.send(new ScanCommand(scanParams));
      lastKey = scanResult.LastEvaluatedKey;

      if (scanResult.Items && scanResult.Items.length > 0) {
        stats.total += scanResult.Items.length;

        // Extract changelog items from raw DynamoDB items
        const changelogItems = scanResult.Items.map((rawItem) => ({
          id: rawItem.item?.id,
          cube: rawItem.item?.cube,
          date: rawItem.item?.date,
          dateCreated: rawItem.item?.dateCreated || rawItem.item?.date,
          dateLastUpdated: rawItem.item?.dateLastUpdated || rawItem.item?.date,
        })).filter((item) => item.id && item.cube && item.date);

        stats.skipped += scanResult.Items.length - changelogItems.length;

        if (changelogItems.length > 0) {
          // Process in chunks for efficient batch updates
          const chunks: (typeof changelogItems)[] = [];
          for (let i = 0; i < changelogItems.length; i += BATCH_SIZE) {
            chunks.push(changelogItems.slice(i, i + BATCH_SIZE));
          }

          // Use Promise.all to update all chunks in parallel
          try {
            await Promise.all(
              chunks.map(async (chunk) => {
                try {
                  await changelogDao.batchPut(chunk);
                  return chunk.length;
                } catch (error) {
                  console.error(`Error updating chunk:`, error);
                  throw error;
                }
              }),
            );

            stats.updated += changelogItems.length;
          } catch (error) {
            console.error(`Error processing batch ${batchNumber}:`, error);
            stats.errors += changelogItems.length;

            if (stats.errors > 1000) {
              console.error('Too many errors, stopping migration');
              throw new Error('Migration failed with too many errors');
            }
          }
        }

        console.log(
          `Batch ${batchNumber}: ${stats.updated.toLocaleString()} updated, ${stats.skipped.toLocaleString()} skipped, ${stats.errors} errors (Total: ${stats.total.toLocaleString()})`,
        );
      }

      // Save checkpoint after each batch
      saveCheckpoint({
        lastKey,
        stats,
        batchNumber,
        timestamp: Date.now(),
      });
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total items processed: ${stats.total.toLocaleString()}`);
    console.log(`Successfully updated: ${stats.updated.toLocaleString()}`);
    console.log(`Skipped (invalid data): ${stats.skipped.toLocaleString()}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    // Delete checkpoint file on successful completion
    deleteCheckpoint();

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
