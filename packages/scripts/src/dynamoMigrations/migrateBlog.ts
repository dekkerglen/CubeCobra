// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import BlogModel from '@server/dynamo/models/blog';
import { BlogDynamoDao } from 'dynamo/dao/BlogDynamoDao';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';

import 'dotenv/config';

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
 */
(async () => {
  try {
    console.log('Starting blog post migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAOs (with dualWrite disabled since we're migrating)
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);
    const blogDao = new BlogDynamoDao(documentClient, changelogDao, cubeDao, tableName, false);

    const stats: MigrationStats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    };

    let lastKey: Record<string, any> | undefined;
    let batchNumber = 0;

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old blog table
      const result = await BlogModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} blog posts in this batch`);

        try {
          // Check which blog posts already exist in new format
          const existingChecks = await Promise.all(
            result.items.map(async (oldBlog) => ({
              blog: oldBlog,
              exists: !!(await blogDao.getById(oldBlog.id!)),
            })),
          );

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
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total blog posts processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
