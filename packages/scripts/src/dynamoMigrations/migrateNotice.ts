// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import NoticeModel from '@server/dynamo/models/notice';
import { UnhydratedNotice } from '@utils/datatypes/Notice';
import { NoticeDynamoDao } from 'dynamo/dao/NoticeDynamoDao';
import { UserDynamoDao } from 'dynamo/dao/UserDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  migrated: number;
  errors: number;
  skipped: number;
}

interface Checkpoint {
  lastKey?: Record<string, any>;
  stats: MigrationStats;
  batchNumber: number;
  timestamp: number;
}

interface ScanResult {
  items?: UnhydratedNotice[];
  lastKey?: Record<string, any>;
}

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migrateNotice-checkpoint.json');

/**
 * Saves checkpoint to disk
 */
const saveCheckpoint = (checkpoint: Checkpoint): void => {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  console.log(`Checkpoint saved: batch ${checkpoint.batchNumber}, ${checkpoint.stats.migrated} migrated`);
};

/**
 * Loads checkpoint from disk
 */
const loadCheckpoint = (): Checkpoint | null => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const checkpoint = JSON.parse(data) as Checkpoint;
      console.log(`Resuming from checkpoint: batch ${checkpoint.batchNumber}, ${checkpoint.stats.migrated} migrated`);
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
 * Migration script to move notices from old DynamoDB format to new single-table format.
 *
 * Old format (NOTICES table):
 * - Simple table with partition key 'id'
 * - GSI on 'status' and 'date' (ByStatus index)
 * - Stores UnhydratedNotice directly
 *
 * New format (Single table design):
 * - PK: NOTICE#{id}
 * - SK: NOTICE
 * - GSI1PK: NOTICE#STATUS#{status}
 * - GSI1SK: DATE#{date}
 * - All other fields remain the same
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migrateNotice-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting notice migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const userDao = new UserDynamoDao(documentClient, tableName, false);
    const noticeDao = new NoticeDynamoDao(documentClient, userDao, tableName, false);

    // Load checkpoint if it exists
    const checkpoint = loadCheckpoint();

    const stats: MigrationStats = checkpoint?.stats || {
      total: 0,
      migrated: 0,
      errors: 0,
      skipped: 0,
    };

    let lastKey: Record<string, any> | undefined = checkpoint?.lastKey;
    let batchNumber = checkpoint?.batchNumber || 0;

    if (checkpoint) {
      console.log('Resuming from previous checkpoint...');
      console.log(`Previous stats: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`);
    }

    do {
      batchNumber += 1;

      // Scan the old notices table
      const result: ScanResult = await NoticeModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        try {
          stats.total += result.items.length;

          // Filter to valid notices first (must have required fields)
          const validItems = result.items.filter((item: UnhydratedNotice) => item.id && item.date && item.status);

          stats.skipped += result.items.length - validItems.length;

          // Check which items already exist in new format
          const existingChecks = await Promise.all(
            validItems.map(async (oldItem: UnhydratedNotice) => ({
              item: oldItem,
              exists: !!(await noticeDao.getById(oldItem.id!)),
            })),
          );

          // Filter to only items that need to be migrated
          const itemsToMigrate = existingChecks.filter((check: any) => !check.exists).map((check: any) => check.item);

          stats.skipped += validItems.length - itemsToMigrate.length;

          // Convert UnhydratedNotice items to Notice items for the DAO
          const noticesForDao = itemsToMigrate.map((item: UnhydratedNotice) => ({
            id: item.id!,
            date: item.date!,
            user: item.user ? ({ id: item.user } as any) : ({ id: '404', username: 'Anonymous' } as any),
            body: item.body!,
            type: item.type!,
            status: item.status!,
            subject: item.subject,
            dateCreated: item.dateCreated || Date.now(),
            dateLastUpdated: item.dateLastUpdated || Date.now(),
          }));

          // Batch put all items at once
          if (noticesForDao.length > 0) {
            await noticeDao.batchPut(noticesForDao);
            stats.migrated += noticesForDao.length;
          }
        } catch (error) {
          console.error(`Error processing batch ${batchNumber}:`, error);
          stats.errors += result.items.length;

          if (stats.errors > 100) {
            console.error('Too many errors, stopping migration');
            throw new Error('Migration failed with too many errors');
          }
        }
      }

      // Log progress every 10 batches
      if (batchNumber % 10 === 0) {
        console.log(
          `Progress: Batch ${batchNumber} | ${stats.migrated.toLocaleString()} migrated, ${stats.skipped.toLocaleString()} skipped, ${stats.errors} errors`,
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
    console.log(`Total notices processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Items without required fields (id, date, status) were skipped.');
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
