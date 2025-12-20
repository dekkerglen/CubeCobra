// Load Environment Variables
import { ScanCommand } from '../../../server/node_modules/@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import { UserDynamoDao } from 'dynamo/dao/UserDynamoDao';
import { UserWithBaseFields } from 'dynamo/dao/UserDynamoDao';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migrateUser-checkpoint.json');

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
 * Migration script to move users from old DynamoDB format to new single-table format.
 *
 * Old format (USERS table):
 * - Simple table with partition key 'id'
 * - GSI on 'usernameLower' (ByUsername)
 * - GSI on 'email' (ByEmail)
 * - Stores user data including sensitive information (passwordHash, email)
 *
 * New format (Single table design):
 * - PK: USER#{id}
 * - SK: USER
 * - GSI1PK: USER#USERNAME#{usernameLower}
 * - GSI1SK: USER
 * - GSI2PK: USER#EMAIL#{email.toLowerCase()}
 * - GSI2SK: USER
 * - Stores user data with same sensitive information preserved
 *
 * Note: This script migrates all user data including sensitive information.
 * The usernameLower field is preserved for GSI indexing.
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migrateUser-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting user migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const userDao = new UserDynamoDao(documentClient, tableName, false);

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

    // Helper function to scan the old users table
    const scanUsers = async (
      lastKey?: Record<string, any>,
    ): Promise<{ items: any[]; lastKey?: Record<string, any> }> => {
      const oldTableName = `${process.env.DYNAMO_PREFIX}_USERS`;

      const scanResult = await documentClient.send(
        new ScanCommand({
          TableName: oldTableName,
          ExclusiveStartKey: lastKey,
        }),
      );

      return {
        items: scanResult.Items ?? [],
        lastKey: scanResult.LastEvaluatedKey,
      };
    };

    do {
      batchNumber += 1;

      // Scan the old users table
      const result = await scanUsers(lastKey);
      lastKey = result.lastKey;

      console.log(`Scanned batch ${batchNumber}, found ${result.items.length} users`);

      if (result.items && result.items.length > 0) {
        try {
          stats.total += result.items.length;

          // Filter to valid users first (must have id and username)
          const validUsers = result.items.filter((user) => user.id && user.username);

          stats.skipped += result.items.length - validUsers.length;

          // Check existing users in parallel
          const existingChecks = await Promise.all(
            validUsers.map(async (oldUser) => ({
              oldUser,
              existing: await userDao.getById(oldUser.id),
            })),
          );

          // Transform to new format
          const usersToMigrate: UserWithBaseFields[] = [];
          const now = Date.now();

          for (const { oldUser, existing } of existingChecks) {
            if (existing) {
              stats.skipped += 1;
              continue;
            }

            // Transform old user to new format with BaseObject fields
            const user: UserWithBaseFields = {
              id: oldUser.id,
              username: oldUser.username,
              usernameLower: oldUser.usernameLower || oldUser.username?.toLowerCase(),
              cubes: oldUser.cubes || [],
              about: oldUser.about,
              hideTagColors: oldUser.hideTagColors,
              followedCubes: oldUser.followedCubes || [],
              followedUsers: oldUser.followedUsers || [],
              following: oldUser.following || [],
              imageName: oldUser.imageName,
              roles: oldUser.roles || [],
              theme: oldUser.theme,
              hideFeatured: oldUser.hideFeatured,
              patron: oldUser.patron,
              defaultPrinting: oldUser.defaultPrinting,
              gridTightness: oldUser.gridTightness,
              autoBlog: oldUser.autoBlog,
              consentToHashedEmail: oldUser.consentToHashedEmail,
              dateCreated: oldUser.dateCreated || now,
              dateLastUpdated: oldUser.dateLastUpdated || now,
            };

            // Preserve sensitive data if present
            if (oldUser.passwordHash) {
              (user as any).passwordHash = oldUser.passwordHash;
            }
            if (oldUser.email) {
              (user as any).email = oldUser.email;
            }

            usersToMigrate.push(user);
          }

          // Batch put all users at once
          if (usersToMigrate.length > 0) {
            await userDao.batchPut(usersToMigrate as any);
            stats.migrated += usersToMigrate.length;
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
      console.log(
        `Progress: Batch ${batchNumber} | ${stats.migrated.toLocaleString()} migrated, ${stats.skipped.toLocaleString()} skipped, ${stats.errors} errors`,
      );

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
    console.log(`Total users processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Users without required fields (id, username) were skipped.');
    console.log('Note: Sensitive data (passwordHash, email) has been preserved in migration.');
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
