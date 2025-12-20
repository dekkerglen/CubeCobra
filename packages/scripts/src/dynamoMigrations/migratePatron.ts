// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import PatronModel from '@server/dynamo/models/patron';
import { PatronDynamoDao } from 'dynamo/dao/PatronDynamoDao';
import Patron from '@utils/datatypes/Patron';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migratePatron-checkpoint.json');

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
 * Migration script to move patrons from old DynamoDB format to new single-table format.
 *
 * Old format (PATRON table):
 * - Simple table with partition key 'owner'
 * - GSI on 'email' for email lookups
 * - Stores patron information with level, status, and timestamps
 *
 * New format (Single table design):
 * - PK: PATRON#{owner}
 * - SK: PATRON
 * - GSI1PK: PATRON#EMAIL#{email}
 * - GSI1SK: PATRON
 * - Includes dateCreated and dateLastUpdated timestamps
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migratePatron-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 *
 * Note: No page limits used - scans entire table in continuous batches
 */
(async () => {
  try {
    console.log('Starting patron migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const patronDao = new PatronDynamoDao(documentClient, tableName, false);

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

      // Scan the old patron table without page limit
      const result = await PatronModel.scan(undefined, lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        try {
          stats.total += result.items.length;

          // Filter to valid patrons first
          const validPatrons = result.items.filter((patron) => patron.owner && patron.email);

          stats.skipped += result.items.length - validPatrons.length;

          // Transform to new format
          const patronsToMigrate: Patron[] = validPatrons.map((oldPatron) => ({
            owner: oldPatron.owner,
            email: oldPatron.email,
            level: oldPatron.level ?? 0,
            status: oldPatron.status ?? 'i',
            dateCreated: oldPatron.dateCreated ?? Date.now(),
            dateLastUpdated: oldPatron.dateLastUpdated ?? Date.now(),
          }));

          // Batch put all patrons at once
          if (patronsToMigrate.length > 0) {
            await patronDao.batchPut(patronsToMigrate);
            stats.migrated += patronsToMigrate.length;
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

      // Log progress every batch (no limit on batches)
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
    console.log(`Total patrons processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Patrons without required fields (owner, email) were skipped.');
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
