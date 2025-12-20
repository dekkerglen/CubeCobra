// Load Environment Variables
import { UserDynamoDao } from '@server/dynamo/dao/UserDynamoDao';
import documentClient from '@server/dynamo/documentClient';
import FeedModel from '@server/dynamo/models/feed';
import { UnhydratedFeed } from '@utils/datatypes/Feed';
import { BlogDynamoDao } from 'dynamo/dao/BlogDynamoDao';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import { FeedDynamoDao } from 'dynamo/dao/FeedDynamoDao';
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
 * - Partition key: 'id' (blog post ID)
 * - Sort key: 'to' (user ID)
 * - GSI 'ByTo': 'to' (PK), 'date' (SK)
 *
 * New format (Single table design):
 * - PK: FEED#{id}
 * - SK: FEED#TO#{to}
 * - GSI1PK: FEED#TO#{to}
 * - GSI1SK: DATE#{date}
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
    const userDao = new UserDynamoDao(documentClient, tableName, false);
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);
    const cubeDao = new CubeDynamoDao(documentClient, userDao, tableName, false);
    const blogDao = new BlogDynamoDao(documentClient, changelogDao, cubeDao, userDao, tableName, false);
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

    do {
      batchNumber += 1;

      // Scan the old feed table
      const result = await FeedModel.scan(undefined, lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        stats.total += result.items.length;

        // Filter to valid feed items first
        const validFeeds = result.items.filter((feed: UnhydratedFeed) => feed.id && feed.to && feed.date && feed.type);

        stats.skipped += result.items.length - validFeeds.length;

        // Check which blog posts exist before trying to migrate
        const blogPostChecks = await Promise.all(
          validFeeds.map(async (feed: UnhydratedFeed) => {
            try {
              const blogPost = await blogDao.getById(feed.id);
              return { feed, exists: !!blogPost };
            } catch {
              return { feed, exists: false };
            }
          }),
        );

        // Filter to only feeds with existing blog posts
        const feedsWithValidBlogs = blogPostChecks.filter((check) => check.exists).map((check) => check.feed);
        const feedsWithMissingBlogs = blogPostChecks.filter((check) => !check.exists);

        if (feedsWithMissingBlogs.length > 0) {
          console.warn(
            `  Skipping ${feedsWithMissingBlogs.length} feed items with missing blog posts (e.g., ${feedsWithMissingBlogs[0].feed.id})`,
          );
          stats.skipped += feedsWithMissingBlogs.length;
        }

        // Transform to unhydrated feed items for batch put
        const feedsToMigrate: UnhydratedFeed[] = feedsWithValidBlogs.map((oldFeed: UnhydratedFeed) => ({
          id: oldFeed.id,
          to: oldFeed.to,
          date: oldFeed.date,
          type: oldFeed.type,
        }));

        // Batch put all feed items at once
        if (feedsToMigrate.length > 0) {
          try {
            await feedDao.batchPutUnhydrated(feedsToMigrate);
            stats.migrated += feedsToMigrate.length;
          } catch (error) {
            console.error(`Error processing batch ${batchNumber}:`, error);
            stats.errors += feedsToMigrate.length;

            if (stats.errors > 100) {
              console.error('Too many errors, stopping migration');
              throw new Error('Migration failed with too many errors');
            }
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
    console.log(`Total feed items processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (invalid or missing blog posts): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log(
      '\n' + 'Note: Feed items without required fields (id, to, date, type) or with missing blog posts were skipped.',
    );
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
