// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import CardHistoryModel from '@server/dynamo/models/cardhistory';
import { UnhydratedCardHistory } from '@utils/datatypes/History';
import { CardHistoryDynamoDao } from 'dynamo/dao/CardHistoryDynamoDao';
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
  items?: UnhydratedCardHistory[];
  lastKey?: Record<string, any>;
}

interface CheckpointData {
  stats: MigrationStats;
  lastKey?: Record<string, any>;
  batchNumber: number;
  timestamp: string;
}

const CHECKPOINT_FILE = path.join(__dirname, 'cardhistory-migration-checkpoint.json');
const CHECKPOINT_INTERVAL = 100000; // Save checkpoint every 100k writes
const SKIP_FIRST_N_ITEMS = 8238000; // Skip the first N items from scan results

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
 * Migration script to move card history from old DynamoDB format to new format.
 *
 * Old format (CARD_HISTORY table):
 * - PK: OTComp (oracle:period e.g., "oracle-123:day")
 * - SK: date (timestamp)
 * - Stores UnhydratedCardHistory directly
 *
 * New format (Single table design):
 * - PK: CARDHISTORY#{oracle}:{type}
 * - SK: DATE#{date}
 * - GSI1PK: CARDHISTORY#ORACLE#{oracle}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: CARDHISTORY#BYDATE
 * - GSI2SK: DATE#{date}
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
    console.log('Starting card history migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const cardHistoryDao = new CardHistoryDynamoDao(documentClient, tableName, false);

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

      // Scan the old card history table
      const result: ScanResult = await CardHistoryModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        // Check if we should skip this batch
        if (stats.total < SKIP_FIRST_N_ITEMS) {
          const itemsToSkip = result.items.length;
          stats.total += itemsToSkip;
          stats.skipped += itemsToSkip;
          console.log(`Skipping batch (total: ${stats.total}/${SKIP_FIRST_N_ITEMS} skipped)`);

          // Add a small delay between batches to avoid throttling
          if (lastKey) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          continue;
        }

        console.log(`Found ${result.items.length} card history entries in this batch`);

        try {
          // Transform to History format (add cubes field)
          const historyItems = result.items.map((item) => {
            // Calculate cubes from cube type data
            let cubes = 0;
            const cubeTypes = [
              'legacy',
              'modern',
              'pauper',
              'vintage',
              'peasant',
              'size180',
              'size360',
              'size450',
              'size540',
              'size720',
            ] as const;

            for (const type of cubeTypes) {
              const value = item[type];
              if (value && Array.isArray(value) && value.length > 0) {
                cubes += value[0]; // First element is the count
              }
            }

            return {
              ...item,
              cubes,
            };
          });

          // Check which entries already exist in new format
          // We'll use a composite key check based on OTComp and date
          const existingChecks = await Promise.all(
            historyItems.map(async (item) => {
              try {
                if (!item.OTComp || !item.OTComp.includes(':')) {
                  // Invalid OTComp, assume it doesn't exist
                  return {
                    item,
                    exists: false,
                  };
                }

                const [oracle, type] = item.OTComp.split(':');
                if (!oracle || !type) {
                  // Invalid OTComp format
                  return {
                    item,
                    exists: false,
                  };
                }

                // Try to query a single item with this exact oracle:type and date
                const existing = await cardHistoryDao.queryByOracleAndType(
                  oracle,
                  type as any,
                  1, // limit to 1
                  undefined,
                );
                // Check if any of the returned items match this exact date
                const exactMatch = existing.items?.some((existingItem) => existingItem.date === item.date);
                return {
                  item,
                  exists: exactMatch || false,
                };
              } catch (_) {
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
            // Batch write all items that need to be migrated
            await cardHistoryDao.batchPut(itemsToMigrate);
            stats.migrated += itemsToMigrate.length;
            migratedSinceLastCheckpoint += itemsToMigrate.length;
            console.log(`Migrated ${itemsToMigrate.length} entries, skipped ${skippedCount}`);
          } else {
            console.log(`All ${result.items.length} entries already exist, skipped`);
          }

          console.log(
            `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
          );
        } catch (error) {
          stats.errors += result.items.length;
          console.error(`Error migrating batch:`, error);

          if (stats.errors > 100) {
            console.error('Too many errors, stopping migration');
            throw new Error('Migration failed with too many errors');
          }
        }
      }

      console.log(
        `Batch ${batchNumber} complete. Stats: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`,
      );

      // Save checkpoint every 100k migrated items
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
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total card history entries processed: ${stats.total}`);
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
