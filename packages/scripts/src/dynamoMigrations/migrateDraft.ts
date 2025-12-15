// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import DraftModel from '@server/dynamo/models/draft';
import { DraftDynamoDao } from 'dynamo/dao/DraftDynamoDao';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import { Draft } from 'dynamo/dao/DraftDynamoDao';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migrateDraft-checkpoint.json');

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
 * Migration script to move drafts from old DynamoDB format to new single-table format.
 *
 * Old format (DRAFT table):
 * - Simple table with partition key 'id'
 * - GSI on 'owner', 'cube', 'cubeOwner', and 'type'
 * - Stores draft metadata
 * - Cards stored in S3 at cardlist/{id}.json
 * - Seats stored in S3 at seats/{id}.json
 *
 * New format (Single table design):
 * - PK: DRAFT#{id}
 * - SK: DRAFT
 * - GSI1PK: DRAFT#OWNER#{ownerId}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: DRAFT#CUBE#{cubeId}
 * - GSI2SK: DATE#{date}
 * - GSI3PK: DRAFT#CUBEOWNER#{cubeOwnerId}
 * - GSI3SK: DATE#{date}
 * - GSI4PK: DRAFT#TYPE#{type}
 * - GSI4SK: DATE#{date}
 * - Cards still in S3 at cardlist/{id}.json (no migration needed)
 * - Seats still in S3 at seats/{id}.json (no migration needed)
 *
 * Note: This script only migrates draft metadata. Cards and seats are already in S3 and don't need migration.
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migrateDraft-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting draft migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAOs (with dualWrite disabled since we're migrating)
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);
    const draftDao = new DraftDynamoDao(documentClient, cubeDao, tableName, false);

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

      // Scan the old draft table
      const result = await DraftModel.scan(200, lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        try {
          stats.total += result.items.length;

          // Filter to valid drafts first
          const validDrafts = result.items.filter((draft) => draft.id && draft.cube && draft.owner && draft.cubeOwner);

          stats.skipped += result.items.length - validDrafts.length;

          // Load cards and seats from S3 in parallel for all drafts in batch
          const s3DataPromises = validDrafts.map(async (oldDraft) => {
            const [cards, seatsData] = await Promise.all([
              draftDao['getCards'](oldDraft.id),
              draftDao['getSeats'](oldDraft.id),
            ]);
            return { oldDraft, cards, seatsData };
          });

          const s3DataResults = await Promise.all(s3DataPromises);

          // Transform to new format
          const draftsToMigrate: Draft[] = [];

          for (const { oldDraft, cards, seatsData } of s3DataResults) {
            // Skip if missing critical S3 data
            if (!cards || !Array.isArray(cards) || cards.length === 0) {
              stats.skipped += 1;
              continue;
            }

            if (!seatsData?.seats || !Array.isArray(seatsData.seats) || seatsData.seats.length === 0) {
              stats.skipped += 1;
              continue;
            }

            // Add details to cards (needed for the draft object)
            const cardsWithDetails = draftDao['addDetails'](cards);

            // Transform old draft to new format
            const draft: Draft = {
              id: oldDraft.id,
              cube: oldDraft.cube,
              owner: oldDraft.owner,
              cubeOwner: oldDraft.cubeOwner,
              date: oldDraft.date,
              dateCreated: oldDraft.date,
              dateLastUpdated: oldDraft.date,
              type: oldDraft.type,
              complete: oldDraft.complete,
              name: oldDraft.name,
              seatNames: oldDraft.seatNames,
              cards: cardsWithDetails,
              seats: seatsData.seats,
              basics: seatsData.basics || [],
              InitialState: seatsData.InitialState || {},
              DraftmancerLog: oldDraft.DraftmancerLog,
            };

            draftsToMigrate.push(draft);
          }

          // Batch put all drafts at once
          if (draftsToMigrate.length > 0) {
            await draftDao.batchPutDrafts(draftsToMigrate);
            stats.migrated += draftsToMigrate.length;
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
    console.log(`Total drafts processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist or invalid): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Cards and seats remain in S3 and do not need migration.');
    console.log('Note: Drafts without required fields (id, cube, owner, cubeOwner) were skipped.');
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
