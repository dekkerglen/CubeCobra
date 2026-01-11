// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import { UserDynamoDao } from 'dynamo/dao/UserDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

import { ScanCommand } from '../../../server/node_modules/@aws-sdk/lib-dynamodb';
import { UserWithSensitiveInformation } from '@utils/datatypes/User';

interface BackfillStats {
  total: number;
  backfilled: number;
  errors: number;
  skipped: number;
  alreadyComplete: number;
}

interface Checkpoint {
  lastKey?: Record<string, any>;
  stats: BackfillStats;
  batchNumber: number;
  timestamp: number;
}

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'backfillUserSensitiveData-checkpoint.json');
const BATCH_SIZE = 25; // DynamoDB batch operations limit

/**
 * Saves checkpoint to disk
 */
const saveCheckpoint = (checkpoint: Checkpoint): void => {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  console.log(
    `Checkpoint saved: batch ${checkpoint.batchNumber}, ${checkpoint.stats.backfilled} backfilled, ${checkpoint.stats.alreadyComplete} already complete`,
  );
};

/**
 * Loads checkpoint from disk
 */
const loadCheckpoint = (): Checkpoint | null => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const checkpoint = JSON.parse(data) as Checkpoint;
      console.log(
        `Resuming from checkpoint: batch ${checkpoint.batchNumber}, ${checkpoint.stats.backfilled} backfilled`,
      );
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
 * Backfill script to restore missing sensitive data (email, passwordHash) from old USERS table
 * to the new shared table.
 *
 * Process:
 * 1. Scan old USERS table
 * 2. Get batches of users
 * 3. For each batch, do a batch get on the new UserDynamoDao with sensitive data
 * 4. If items in new table are missing email and/or passwordHash, copy from old table
 * 5. Update the new table with the restored data
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to backfillUserSensitiveData-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting backfill of user sensitive data from old USERS table to shared table');
    console.log('='.repeat(80));

    const newTableName = process.env.DYNAMO_TABLE;
    const oldTableName = `${process.env.DYNAMO_PREFIX}_USERS`;

    if (!newTableName || !oldTableName) {
      throw new Error('DYNAMO_TABLE and DYNAMO_PREFIX environment variables must be set');
    }

    console.log(`Old table: ${oldTableName}`);
    console.log(`New table: ${newTableName}`);
    console.log('');

    // Initialize UserDynamoDao for new table access
    const userDao = new UserDynamoDao(documentClient, newTableName);

    // Load checkpoint if exists
    const checkpoint = loadCheckpoint();
    const stats: BackfillStats = checkpoint?.stats || {
      total: 0,
      backfilled: 0,
      errors: 0,
      skipped: 0,
      alreadyComplete: 0,
    };

    let lastKey = checkpoint?.lastKey;
    let batchNumber = checkpoint?.batchNumber || 0;
    let hasMore = true;

    while (hasMore) {
      batchNumber++;

      // Scan old USERS table
      const scanCommand = new ScanCommand({
        TableName: oldTableName,
        Limit: BATCH_SIZE,
        ExclusiveStartKey: lastKey,
      });

      const scanResult = await documentClient.send(scanCommand);
      const oldUsers = (scanResult.Items || []) as UserWithSensitiveInformation[];

      if (oldUsers.length === 0) {
        console.log('No more items to process');
        break;
      }

      stats.total += oldUsers.length;

      console.log(`\nBatch ${batchNumber}: Processing ${oldUsers.length} users...`);

      // Batch get from new table to check for missing data
      const userIds = oldUsers.map((user) => user.id);

      try {
        const newUsers = await userDao.batchGetWithSensitiveData(userIds);

        // Create a map for easy lookup
        const newUsersMap = new Map(newUsers.map((user) => [user.id, user]));

        // Check each old user and determine if backfill is needed
        const usersToUpdate: UserWithSensitiveInformation[] = [];

        for (const oldUser of oldUsers) {
          const newUser = newUsersMap.get(oldUser.id);

          if (!newUser) {
            console.log(`  [SKIP] User ${oldUser.id} (${oldUser.username}) not found in new table`);
            stats.skipped++;
            continue;
          }

          // Check if sensitive data is missing
          const missingEmail = !newUser.email && oldUser.email;
          const missingPasswordHash = !newUser.passwordHash && oldUser.passwordHash;

          if (missingEmail || missingPasswordHash) {
            // Create updated user with restored sensitive data
            const updatedUser = { ...newUser } as any;

            if (missingEmail && oldUser.email) {
              updatedUser.email = oldUser.email;
              console.log(`  [RESTORE] User ${oldUser.id} (${oldUser.username}): email`);
            }

            if (missingPasswordHash && oldUser.passwordHash) {
              updatedUser.passwordHash = oldUser.passwordHash;
              console.log(`  [RESTORE] User ${oldUser.id} (${oldUser.username}): passwordHash`);
            }

            usersToUpdate.push(updatedUser);
            stats.backfilled++;
          } else {
            stats.alreadyComplete++;
          }
        }

        // Batch update users that need backfilling
        if (usersToUpdate.length > 0) {
          console.log(`  Updating ${usersToUpdate.length} users...`);

          for (const userToUpdate of usersToUpdate) {
            try {
              await userDao.update(userToUpdate as any);
            } catch (error) {
              console.error(`  [ERROR] Failed to update user ${userToUpdate.id}:`, error);
              stats.errors++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing batch ${batchNumber}:`, error);
        stats.errors += oldUsers.length;
      }

      // Update pagination
      lastKey = scanResult.LastEvaluatedKey;
      hasMore = !!lastKey;

      // Save checkpoint after each batch
      saveCheckpoint({
        lastKey,
        stats,
        batchNumber,
        timestamp: Date.now(),
      });

      // Progress report
      console.log(
        `Batch ${batchNumber} complete. Total: ${stats.total}, Backfilled: ${stats.backfilled}, Already Complete: ${stats.alreadyComplete}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`,
      );
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('Backfill Complete!');
    console.log(`Total users processed: ${stats.total}`);
    console.log(`Users with data restored: ${stats.backfilled}`);
    console.log(`Users already complete: ${stats.alreadyComplete}`);
    console.log(`Users skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    // Delete checkpoint file on success
    deleteCheckpoint();

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during backfill:', error);
    process.exit(1);
  }
})();
