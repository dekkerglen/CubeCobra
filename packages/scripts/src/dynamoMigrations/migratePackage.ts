// Load Environment Variables
import { UserDynamoDao } from '@server/dynamo/dao/UserDynamoDao';
import documentClient from '@server/dynamo/documentClient';
import PackageModel from '@server/dynamo/models/package';
import { PackageDynamoDao } from 'dynamo/dao/PackageDynamoDao';
import { UnhydratedCardPackage } from '@utils/datatypes/CardPackage';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migratePackage-checkpoint.json');

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
 * Migration script to move packages from old DynamoDB format to new single-table format.
 *
 * Old format (PACKAGE table):
 * - Simple table with partition key 'id'
 * - GSI on 'status' with sort key 'voteCount' (ByVoteCount)
 * - GSI on 'status' with sort key 'date' (ByDate)
 * - GSI on 'owner' with sort key 'date' (ByOwner)
 * - Stores package metadata including cards (as scryfall_ids)
 *
 * New format (Single table design):
 * - PK: PACKAGE#{id}
 * - SK: PACKAGE
 * - GSI1PK: PACKAGE#STATUS#{status}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: PACKAGE#STATUS#{status}
 * - GSI2SK: VOTECOUNT#{voteCount}
 * - GSI3PK: PACKAGE#OWNER#{ownerId}
 * - GSI3SK: DATE#{date}
 * - Stores package metadata including cards (as scryfall_ids)
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migratePackage-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting package migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAOs (with dualWrite disabled since we're migrating)
    const userDao = new UserDynamoDao(documentClient, tableName, false);
    const packageDao = new PackageDynamoDao(documentClient, userDao, tableName, false);

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

      // Scan the old package table
      const result = await PackageModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        try {
          stats.total += result.items.length;

          // Filter to valid packages first
          const validPackages = result.items.filter((pkg) => pkg.id && pkg.owner && pkg.status);

          stats.skipped += result.items.length - validPackages.length;

          // Transform to new format
          const packagesToMigrate: UnhydratedCardPackage[] = [];

          for (const oldPackage of validPackages) {
            // Ensure cards are stored as scryfall_ids
            const cardIds = oldPackage.cards
              .map((card: any) => {
                if (typeof card !== 'string' && card.scryfall_id) {
                  return card.scryfall_id;
                } else if (typeof card === 'string') {
                  return card;
                }
                return undefined;
              })
              .filter((cardId: any) => cardId !== undefined) as string[];

            // Transform old package to new format
            const pkg: UnhydratedCardPackage = {
              id: oldPackage.id,
              title: oldPackage.title,
              date: oldPackage.date,
              owner: oldPackage.owner,
              status: oldPackage.status,
              cards: cardIds,
              keywords: oldPackage.keywords || [],
              voters: oldPackage.voters || [],
              voteCount: oldPackage.voteCount || oldPackage.voters?.length || 0,
              dateCreated: oldPackage.dateCreated || oldPackage.date || Date.now(),
              dateLastUpdated: oldPackage.dateLastUpdated || oldPackage.date || Date.now(),
            };

            packagesToMigrate.push(pkg);
          }

          // Batch put all packages at once
          if (packagesToMigrate.length > 0) {
            await packageDao.batchPut(packagesToMigrate);
            stats.migrated += packagesToMigrate.length;
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
    console.log(`Total packages processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Packages without required fields (id, owner, status) were skipped.');
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
