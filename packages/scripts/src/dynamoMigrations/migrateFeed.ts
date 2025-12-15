// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import { BlogDynamoDao } from 'dynamo/dao/BlogDynamoDao';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import { FeedDynamoDao } from 'dynamo/dao/FeedDynamoDao';
import { UnhydratedFeed } from '@utils/datatypes/Feed';
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

const CHECKPOINT_FILE = path.join(__dirname, '..', '..', 'temp', 'migrateFeed-checkpoint.json');

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
 * Migration script to move feed items from old DynamoDB format to new single-table format.
 *
 * Old format (FEED table):
 * - Partition key: 'id' (the blog post ID)
 * - Sort key: 'to' (the user receiving the feed item)
 * - GSI 'ByTo': partition key 'to', sort key 'date'
 * - Attributes: id, to, date, type
 * - Feed items reference blog posts by ID
 *
 * New format (Single table design):
 * - PK: FEED#{id} (the blog post ID)
 * - SK: FEED#TO#{to} (the user receiving the feed item)
 * - GSI1PK: FEED#TO#{to}
 * - GSI1SK: DATE#{date}
 * - Additional fields: dateCreated, dateLastUpdated
 * - Feed items still reference blog posts by ID (hydrated on read)
 *
 * CHECKPOINTING:
 * - Progress is saved after each batch to migrateFeed-checkpoint.json
 * - If interrupted, run again to resume from last checkpoint
 * - Checkpoint file is deleted upon successful completion
 */
(async () => {
  try {
    console.log('Starting feed migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAOs (with dualWrite disabled since we're migrating)
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);
    const blogDao = new BlogDynamoDao(documentClient, changelogDao, cubeDao, tableName, false);
    const feedDao = new FeedDynamoDao(documentClient, blogDao, tableName, false);

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

    // Since the old Feed model doesn't have a scan method, we need to scan the table directly
    // We'll use the DynamoDB DocumentClient to scan the old FEED table
    const oldTableName = 'FEED';
    console.log(`Scanning old table: ${oldTableName}`);

    do {
      batchNumber += 1;

      try {
        // Scan the old feed table directly using DocumentClient
        const scanResult = await documentClient.scan({
          TableName: oldTableName,
          Limit: 200,
          ExclusiveStartKey: lastKey,
        });

        lastKey = scanResult.LastEvaluatedKey;

        if (scanResult.Items && scanResult.Items.length > 0) {
          const oldFeeds = scanResult.Items as UnhydratedFeed[];
          stats.total += oldFeeds.length;

          // Filter to valid feed items
          const validFeeds = oldFeeds.filter((feed) => {
            // Check required fields
            if (!feed.id || !feed.to || !feed.date || !feed.type) {
              return false;
            }
            return true;
          });

          stats.skipped += oldFeeds.length - validFeeds.length;

          if (validFeeds.length > 0) {
            // Batch put using the new DAO
            // The DAO will hydrate the feed items by fetching the blog posts
            await feedDao.batchPutUnhydrated(validFeeds);
            stats.migrated += validFeeds.length;
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

        // If the error is about a blog post not found, we should skip those items
        if (error instanceof Error && error.message.includes('not found for feed item')) {
          console.warn('Skipping feed items with missing blog posts');
          stats.skipped += 1;
        } else {
          stats.errors += 1;

          if (stats.errors > 100) {
            console.error('Too many errors, stopping migration');
            throw new Error('Migration failed with too many errors');
          }
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
    console.log(`Total feed items processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exist, invalid, or missing blog posts): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Feed items without required fields (id, to, date, type) were skipped.');
    console.log('Note: Feed items pointing to non-existent blog posts were skipped.');
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
