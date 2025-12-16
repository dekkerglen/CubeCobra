// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import ChangelogModel from '@server/dynamo/models/changelog';
import ChangeLogType from '@utils/datatypes/ChangeLog';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

interface ScanResult {
  items?: ChangeLogType[];
  lastKey?: Record<string, any>;
}

interface CheckpointData {
  stats: MigrationStats;
  lastKey?: Record<string, any>;
  batchNumber: number;
  timestamp: string;
}

const CHECKPOINT_FILE = path.join(__dirname, 'changelog-migration-checkpoint.json');
const CHECKPOINT_INTERVAL = 10000; // Save checkpoint every 10k writes
const BATCH_SIZE = 1000; // Process 1000 items at a time from DynamoDB scan

/**
 * Load checkpoint data from file if it exists
 */
function loadCheckpoint(): CheckpointData | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const checkpoint = JSON.parse(data) as CheckpointData;
      console.log(`Loaded checkpoint from ${checkpoint.timestamp}`);
      console.log(`Resuming from batch ${checkpoint.batchNumber}`);
      console.log(
        `Previous progress: ${checkpoint.stats.total} processed (${checkpoint.stats.migrated} migrated, ${checkpoint.stats.skipped} skipped, ${checkpoint.stats.errors} errors)`,
      );
      return checkpoint;
    }
  } catch (error) {
    console.warn('Failed to load checkpoint, starting fresh:', error);
  }
  return null;
}

/**
 * Save checkpoint data to file
 */
function saveCheckpoint(data: CheckpointData): void {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Checkpoint saved at batch ${data.batchNumber} (${data.stats.migrated} migrated so far)`);
  } catch (error) {
    console.error('Failed to save checkpoint:', error);
  }
}

/**
 * Delete checkpoint file when migration completes
 */
function deleteCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('Checkpoint file deleted');
    }
  } catch (error) {
    console.warn('Failed to delete checkpoint file:', error);
  }
}

/**
 * Migration script to move changelogs from old DynamoDB format to new format.
 *
 * Old format (CUBE_CHANGELOG table):
 * - PK: cube (cube ID)
 * - SK: date (timestamp)
 * - Attributes: id (changelog ID)
 * - Changelog data stored in S3 at: changelog/{cube}/{id}.json
 *
 * New format (Single table design):
 * - PK: CHANGELOG#{id}
 * - SK: CHANGELOG
 * - GSI1PK: CHANGELOG#CUBE#{cube}
 * - GSI1SK: DATE#{date}
 * - Attributes: cube, date, dateCreated, dateLastUpdated
 * - Changelog data remains in S3 at: changelog/{cube}/{id}.json
 *
 * Note: This migration only moves the metadata. The S3 data stays in the same location.
 */
(async () => {
  // Declare variables in outer scope so they're accessible in catch block
  let stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };
  let lastKey: Record<string, any> | undefined;
  let batchNumber = 0;

  try {
    console.log('Starting changelog migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);
    console.log('Note: Changelog data in S3 will not be moved, only metadata is migrated');

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);

    // Try to load checkpoint
    const checkpoint = loadCheckpoint();

    if (checkpoint) {
      stats = checkpoint.stats;
      lastKey = checkpoint.lastKey;
      batchNumber = checkpoint.batchNumber;
    }

    let migratedSinceLastCheckpoint = 0;

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old changelog table
      const result: ScanResult = await ChangelogModel.scan(BATCH_SIZE, lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} changelog entries in this batch`);

        // Check which entries already exist in new format (in parallel)
        const existingChecks = await Promise.all(
          result.items.map(async (item) => {
            try {
              // Try to get the changelog by ID
              const existing = await changelogDao.getById(item.id);
              return {
                item,
                exists: !!existing,
              };
            } catch {
              // If error, assume it doesn't exist
              return {
                item,
                exists: false,
              };
            }
          }),
        );

        // Filter to only items that need to be migrated
        const itemsToMigrate = existingChecks.filter((check) => !check.exists).map((check) => check.item);

        const skippedCount = result.items.length - itemsToMigrate.length;
        stats.skipped += skippedCount;
        stats.total += result.items.length;

        if (itemsToMigrate.length > 0) {
          // Transform old format to new format
          const changelogItems = itemsToMigrate.map((item) => ({
            id: item.id,
            cube: item.cube,
            date: item.date,
            dateCreated: item.dateCreated || item.date, // Use date as fallback if dateCreated doesn't exist
            dateLastUpdated: item.dateLastUpdated || item.date, // Use date as fallback if dateLastUpdated doesn't exist
          }));

          // Process items in chunks of 25 for batch write
          const chunks: (typeof changelogItems)[] = [];
          for (let i = 0; i < changelogItems.length; i += 25) {
            chunks.push(changelogItems.slice(i, i + 25));
          }

          // Use Promise.all to call batchPut in parallel for all chunks
          try {
            await Promise.all(chunks.map((chunk) => changelogDao.batchPut(chunk)));
            stats.migrated += changelogItems.length;
            migratedSinceLastCheckpoint += changelogItems.length;
            console.log(`Migrated ${itemsToMigrate.length} entries, skipped ${skippedCount}`);
          } catch (error) {
            console.error(`Error migrating batch of ${changelogItems.length} changelogs:`, error);
            stats.errors += changelogItems.length;

            if (stats.errors > 100) {
              console.error('Too many errors, stopping migration');
              throw new Error('Migration failed with too many errors');
            }
          }
        } else {
          console.log(`All ${result.items.length} entries already exist, skipped`);
        }

        console.log(
          `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
        );
      }

      console.log(
        `Batch ${batchNumber} complete. Stats: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`,
      );

      // Save checkpoint every CHECKPOINT_INTERVAL migrated items
      if (migratedSinceLastCheckpoint >= CHECKPOINT_INTERVAL) {
        saveCheckpoint({
          stats,
          lastKey,
          batchNumber,
          timestamp: new Date().toISOString(),
        });
        migratedSinceLastCheckpoint = 0;
      }

      // Add a small delay between batches to avoid throttling
      if (lastKey) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total changelog entries processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
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

    // Save final checkpoint on error so we can resume
    try {
      saveCheckpoint({
        stats,
        lastKey,
        batchNumber,
        timestamp: new Date().toISOString(),
      });
      console.log('Checkpoint saved before exit');
    } catch (checkpointError) {
      console.error('Failed to save checkpoint on error:', checkpointError);
    }

    process.exit(1);
  }
})();
