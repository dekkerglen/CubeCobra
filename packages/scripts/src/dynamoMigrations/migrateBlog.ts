// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import BlogModel from '@server/dynamo/models/blog';
import { BlogDynamoDao } from 'dynamo/dao/BlogDynamoDao';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import { UserDynamoDao } from 'dynamo/dao/UserDynamoDao';

import 'dotenv/config';

import { CheckpointManager } from './checkpointUtil';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

/**
 * Migration script to move blog posts from old DynamoDB format to new format.
 *
 * Old format (BLOG table):
 * - Simple table with partition key 'id'
 * - GSI on 'cube' and 'owner'
 * - Stores UnhydratedBlogPost directly
 *
 * New format (Single table design):
 * - PK: BLOG#{id}
 * - SK: BLOG
 * - GSI1PK: BLOG#CUBE#{cube}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: BLOG#OWNER#{ownerId}
 * - GSI2SK: DATE#{date}
 *
 * Supports checkpointing: Run with --resume to continue from last checkpoint,
 * or --reset to clear checkpoint and start fresh.
 */
(async () => {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldResume = args.includes('--resume');
    const shouldReset = args.includes('--reset');

    const checkpointManager = new CheckpointManager('migrateBlog');

    if (shouldReset) {
      console.log('Clearing checkpoint and starting fresh...');
      checkpointManager.clear();
    }

    console.log('Starting blog post migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    const userDao = new UserDynamoDao(documentClient, tableName, false);
    // Initialize the DAOs (with dualWrite disabled since we're migrating)
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);
    const cubeDao = new CubeDynamoDao(documentClient, userDao, tableName, false);
    const blogDao = new BlogDynamoDao(documentClient, changelogDao, cubeDao, userDao, tableName, false);

    const stats: MigrationStats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    };

    let lastKey: Record<string, any> | undefined;
    let batchNumber = 0;

    // Try to resume from checkpoint
    if (shouldResume && checkpointManager.exists()) {
      const checkpoint = checkpointManager.load();
      if (checkpoint) {
        console.log('\nResuming from checkpoint...');
        console.log(
          `Previous run: batch ${checkpoint.batchNumber}, timestamp: ${new Date(checkpoint.timestamp).toISOString()}`,
        );
        lastKey = checkpoint.lastKey;
        batchNumber = checkpoint.batchNumber;
        stats.total = checkpoint.stats.total || 0;
        stats.migrated = checkpoint.stats.migrated || 0;
        stats.skipped = checkpoint.stats.skipped || 0;
        stats.errors = checkpoint.stats.errors || 0;
        console.log(
          `Resuming with stats: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`,
        );
        console.log('='.repeat(80));
      }
    }

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old blog table
      const result = await BlogModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} blog posts in this batch`);

        try {
          // Check which blog posts already exist in new format by directly querying DynamoDB
          // We use direct get instead of getById to avoid hydration which would fail for blogs with null owners
          // Process in smaller chunks to avoid overwhelming the connection pool
          const existingChecks: Array<{ blog: any; exists: boolean }> = [];
          const chunkSize = 50; // Process 50 at a time to avoid socket exhaustion

          for (let i = 0; i < result.items.length; i += chunkSize) {
            const chunk = result.items.slice(i, i + chunkSize);
            const chunkChecks = await Promise.all(
              chunk.map(async (oldBlog) => {
                try {
                  const response = await documentClient.get({
                    TableName: tableName,
                    Key: {
                      PK: `BLOG#${oldBlog.id}`,
                      SK: 'BLOG',
                    },
                  });
                  return {
                    blog: oldBlog,
                    exists: !!response.Item,
                  };
                } catch (error) {
                  console.warn(`Error checking existence of blog ${oldBlog.id}:`, error);
                  return {
                    blog: oldBlog,
                    exists: false, // Assume doesn't exist if we can't check
                  };
                }
              }),
            );
            existingChecks.push(...chunkChecks);
          }

          // Filter to only blog posts that need to be migrated
          const blogsToMigrate = existingChecks
            .filter((check) => !check.exists)
            .map((check) => ({
              id: check.blog.id!,
              body: check.blog.body || '',
              owner: check.blog.owner ? ({ id: check.blog.owner } as any) : ({ id: '404' } as any),
              date: check.blog.date || Date.now(),
              dateCreated: check.blog.dateCreated || check.blog.date || Date.now(),
              dateLastUpdated: check.blog.dateLastUpdated || check.blog.date || Date.now(),
              cube: check.blog.cube,
              title: check.blog.title,
              cubeName: '', // Will be hydrated on read
              Changelog: undefined, // Will be loaded if changelist exists
              changelist: check.blog.changelist, // Include the changelist reference
            }));

          const skippedCount = result.items.length - blogsToMigrate.length;
          stats.skipped += skippedCount;
          stats.total += result.items.length;

          if (blogsToMigrate.length > 0) {
            // Batch write all blog posts that need to be migrated
            await blogDao.batchPut(blogsToMigrate);
            stats.migrated += blogsToMigrate.length;
            console.log(`Migrated ${blogsToMigrate.length} blog posts, skipped ${skippedCount}`);
          } else {
            console.log(`All ${result.items.length} blog posts already exist, skipped`);
          }

          console.log(
            `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
          );
        } catch (error) {
          stats.errors += result.items.length;
          console.error(`Error migrating batch:`, error);

          if (stats.errors > 100) {
            console.error('Too many errors, stopping migration');
            throw new Error('Migration failed with too many errors');
          }
        }
      }

      console.log(
        `Batch ${batchNumber} complete. Stats: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`,
      );

      // Save checkpoint after each batch
      checkpointManager.save({
        lastKey,
        stats: {
          total: stats.total,
          migrated: stats.migrated,
          skipped: stats.skipped,
          errors: stats.errors,
        },
        timestamp: Date.now(),
        batchNumber,
      });
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total blog posts processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    // Clear checkpoint on successful completion
    checkpointManager.clear();
    console.log('Checkpoint cleared.');

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
