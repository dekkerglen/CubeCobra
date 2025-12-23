// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import p1p1PackModel from '@server/dynamo/models/p1p1Pack';
import { P1P1PackDynamoDao, P1P1PackExtended } from 'dynamo/dao/P1P1PackDynamoDao';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migrateP1P1Pack-checkpoint.json');

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
 * Migration script to move P1P1 packs from old DynamoDB format to new single-table format.
 *
 * Old format (P1P1_PACKS table):
 * - Simple table with partition key 'id'
 * - GSI on 'cubeId' and 'date' (ByCube index)
 * - Stores P1P1PackDynamoData (metadata only)
 * - Extended data (cards, etc.) stored in S3 at p1p1-packs/{id}.json
 *
 * New format (Single table design):
 * - PK: P1P1PACK#{id}
 * - SK: P1P1PACK
 * - GSI1PK: P1P1PACK#CUBE#{cubeId}
 * - GSI1SK: DATE#{date}
 * - Extended data still in S3 at p1p1-packs/{id}.json (no migration needed)
 *
 * Note: This script only migrates pack metadata. S3 data is already in place and doesn't need migration.
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migrateP1P1Pack-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting P1P1 pack migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const p1p1PackDao = new P1P1PackDynamoDao(documentClient, tableName, false);

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

      // Scan the old P1P1_PACKS table
      const result = await p1p1PackModel.scan(undefined, lastKey);
      lastKey = result.lastKey;
      const items = result.items || [];

      if (items.length > 0) {
        try {
          stats.total += items.length;

          // Filter to valid packs first (must have required fields)
          const validPacks = items.filter((pack: any) => pack.id && pack.cubeId && pack.date);

          stats.skipped += items.length - validPacks.length;

          // Check which packs already exist in new format
          const existingChecks = await Promise.all(
            validPacks.map(async (oldPack: any) => ({
              pack: oldPack,
              exists: !!(await p1p1PackDao.getById(oldPack.id)),
            })),
          );

          // Filter to only packs that need to be migrated
          const packsToMigrate = existingChecks.filter((check: any) => !check.exists).map((check: any) => check.pack);

          stats.skipped += validPacks.length - packsToMigrate.length;

          // Load S3 data for all packs in batch
          const s3DataPromises = packsToMigrate.map(async (oldPack: any) => {
            const s3Data = await p1p1PackDao['getS3Data'](oldPack.id);
            return { oldPack, s3Data };
          });

          const s3DataResults = await Promise.all(s3DataPromises);

          // Transform to new format
          const packsForDao: P1P1PackExtended[] = [];

          for (const { oldPack, s3Data } of s3DataResults) {
            // Skip if missing critical S3 data
            if (!s3Data || !s3Data.cards || !Array.isArray(s3Data.cards) || s3Data.cards.length === 0) {
              stats.skipped += 1;
              continue;
            }

            // Add details to cards (needed for the pack object)
            const cardsWithDetails = p1p1PackDao['addDetails'](s3Data.cards);

            // Transform old pack to new format
            const pack: P1P1PackExtended = {
              id: oldPack.id,
              createdBy: oldPack.createdBy,
              cubeId: oldPack.cubeId,
              date: oldPack.date,
              votesByUser: oldPack.votesByUser || {},
              dateCreated: oldPack.date,
              dateLastUpdated: oldPack.date,
              ...s3Data,
              cards: cardsWithDetails,
            };

            packsForDao.push(pack);
          }

          // Batch put all packs at once
          if (packsForDao.length > 0) {
            await p1p1PackDao.batchPut(packsForDao);
            stats.migrated += packsForDao.length;
          }
        } catch (error) {
          console.error(`Error processing batch ${batchNumber}:`, error);
          stats.errors += items.length;

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
    console.log(`Total P1P1 packs processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: S3 pack data remains in place and does not need migration.');
    console.log('Note: Packs without required fields (id, cubeId, date) or missing S3 data were skipped.');
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
