// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import Notification from '@utils/datatypes/Notification';
import { NotificationDynamoDao } from 'dynamo/dao/NotificationDynamoDao';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migrateNotification-checkpoint.json');

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
 * Migration script to move notifications from old DynamoDB format to new single-table format.
 *
 * Old format (NOTIFICATIONS table):
 * - Partition key: 'id'
 * - GSI1 (ByTo): partition key 'to', sort key 'date'
 * - GSI2 (ByToStatusComp): partition key 'toStatusComp', sort key 'date'
 * - Fields: id, date, to, from, fromUsername, url, body, status, toStatusComp
 *
 * New format (Single table design):
 * - PK: NOTIFICATION#{id}
 * - SK: NOTIFICATION
 * - GSI1PK: NOTIFICATION#TO#{to}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: NOTIFICATION#TO#{to}#STATUS#{status}
 * - GSI2SK: DATE#{date}
 * - DynamoVersion: 1 (for optimistic locking)
 * - item: { all notification fields including dateCreated, dateLastUpdated }
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migrateNotification-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting notification migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const notificationDao = new NotificationDynamoDao(documentClient, tableName, false);

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

    // Scan the old NOTIFICATIONS table directly using DocumentClient
    const oldTableName = `${process.env.DYNAMO_PREFIX}_NOTIFICATIONS`;
    console.log(`Scanning old table: ${oldTableName}`);

    do {
      batchNumber += 1;

      try {
        // Scan the old notifications table directly
        const scanResult = await documentClient.scan({
          TableName: oldTableName,
          Limit: 200,
          ExclusiveStartKey: lastKey,
        });

        lastKey = scanResult.LastEvaluatedKey;

        if (scanResult.Items && scanResult.Items.length > 0) {
          const oldNotifications = scanResult.Items as Notification[];
          stats.total += oldNotifications.length;

          // Filter to valid notifications (must have required fields)
          const validNotifications = oldNotifications.filter((notification) => {
            if (!notification.id || !notification.date || !notification.to) {
              console.warn(`Skipping notification with missing required fields: ${notification.id}`);
              return false;
            }
            return true;
          });

          stats.skipped += oldNotifications.length - validNotifications.length;

          // Check which items already exist in new format
          const existingChecks = await Promise.all(
            validNotifications.map(async (notification) => ({
              item: notification,
              exists: !!(await notificationDao.getById(notification.id)),
            })),
          );

          // Filter to only items that need to be migrated
          const itemsToMigrate = existingChecks
            .filter((check) => !check.exists)
            .map((check) => check.item);

          const alreadyExistCount = validNotifications.length - itemsToMigrate.length;
          stats.skipped += alreadyExistCount;

          if (itemsToMigrate.length > 0) {
            // Add dateCreated and dateLastUpdated if missing
            const notificationsWithTimestamps = itemsToMigrate.map((notification) => ({
              ...notification,
              dateCreated: notification.dateCreated || notification.date || Date.now(),
              dateLastUpdated: notification.dateLastUpdated || notification.date || Date.now(),
              // Ensure toStatusComp is set correctly
              toStatusComp: `${notification.to}:${notification.status}`,
            }));

            // Batch put all items at once
            await notificationDao.batchPut(notificationsWithTimestamps);
            stats.migrated += notificationsWithTimestamps.length;
          }

          // Log progress every 10 batches
          if (batchNumber % 10 === 0) {
            console.log(
              `Progress: Batch ${batchNumber} | ${stats.migrated.toLocaleString()} migrated, ${stats.skipped.toLocaleString()} skipped, ${stats.errors} errors`,
            );
          }
        }
      } catch (error) {
        console.error(`Error processing batch ${batchNumber}:`, error);
        stats.errors += 1;

        // Don't increment migrated/skipped for the whole batch on error
        // Individual items are already counted before the batch operation

        if (stats.errors > 100) {
          console.error('Too many errors, stopping migration');
          throw new Error('Migration failed with too many errors');
        }
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
    console.log(`Total notifications processed: ${stats.total.toLocaleString()}`);
    console.log(`Successfully migrated: ${stats.migrated.toLocaleString()}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped.toLocaleString()}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Items without required fields (id, date, to) were skipped.');
    console.log('='.repeat(80));

    // Delete checkpoint file on successful completion
    deleteCheckpoint();

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    console.error('\nCheckpoint file preserved for retry. Run the script again to resume.');
    process.exit(1);
  }
})();

```
