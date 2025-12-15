// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import BlogModel from '@server/dynamo/models/blog';
import { BlogDynamoDao } from 'dynamo/dao/BlogDynamoDao';
import { ChangelogDynamoDao } from 'dynamo/dao/ChangelogDynamoDao';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';

import 'dotenv/config';

interface FixStats {
  total: number;
  fixed: number;
  skipped: number;
  notFound: number;
  errors: number;
}

/**
 * Script to fix blog posts that are missing changelog references in the new DynamoDB format.
 *
 * This script:
 * 1. Scans the old BLOG table for all blog posts with changelists
 * 2. For each blog post, fetches the corresponding blog from the new table
 * 3. Updates the new blog post with the correct changelog reference
 *
 * Usage:
 *   npm run fix-blog-changelogs                    # Fix all blogs
 *   npm run fix-blog-changelogs -- --blog-id=<id>  # Fix a single blog for testing
 */
(async () => {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const blogIdArg = args.find((arg) => arg.startsWith('--blog-id='));
    const singleBlogId = blogIdArg ? blogIdArg.split('=')[1] : null;

    if (singleBlogId) {
      console.log(`Starting blog changelog fix for single blog: ${singleBlogId}`);
    } else {
      console.log('Starting blog changelog fix - restoring missing changelog references');
    }
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAOs
    const changelogDao = new ChangelogDynamoDao(documentClient, tableName, false);
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);
    const blogDao = new BlogDynamoDao(documentClient, changelogDao, cubeDao, tableName, false);

    const stats: FixStats = {
      total: 0,
      fixed: 0,
      skipped: 0,
      notFound: 0,
      errors: 0,
    };

    // Handle single blog ID case
    if (singleBlogId) {
      console.log(`\nFetching blog ${singleBlogId} from old table...`);

      try {
        const oldBlog = await BlogModel.getUnhydrated(singleBlogId);

        if (!oldBlog) {
          console.error(`Blog ${singleBlogId} not found in old table`);
          process.exit(1);
        }

        console.log(`Found blog: ${oldBlog.title || '(no title)'}`);
        console.log(`Changelist: ${oldBlog.changelist || '(none)'}`);

        if (!oldBlog.changelist) {
          console.log(`Blog has no changelist, nothing to fix`);
          process.exit(0);
        }

        // Fetch the blog from the new table
        console.log(`\nFetching blog from new table...`);
        const newBlog = await blogDao.getById(singleBlogId);

        if (!newBlog) {
          console.error(`Blog ${singleBlogId} not found in new table`);
          process.exit(1);
        }

        console.log(`Current changelist in new table: ${newBlog.changelist || '(none)'}`);

        // Check if the changelog reference is already set correctly
        if (newBlog.changelist === oldBlog.changelist) {
          console.log(`Blog already has correct changelog reference, nothing to fix`);
          process.exit(0);
        }

        // Update the blog with the correct changelog reference
        console.log(`\nUpdating blog with changelog ${oldBlog.changelist}...`);
        newBlog.changelist = oldBlog.changelist;

        await blogDao.update(newBlog);

        console.log(`✓ Successfully fixed blog ${singleBlogId}`);
        console.log('='.repeat(80));
        process.exit(0);
      } catch (error) {
        console.error(`\nError fixing blog ${singleBlogId}:`, error);
        process.exit(1);
      }
    }

    // Handle full scan case
    let lastKey: Record<string, any> | undefined;
    let batchNumber = 0;

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old blog table (DynamoDB will use default page size)
      const result = await BlogModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} blog posts in this batch`);

        // Filter to only blog posts that have changelists
        const blogsWithChangelists = result.items.filter((blog) => blog.changelist);

        if (blogsWithChangelists.length === 0) {
          console.log(`No blog posts with changelists in this batch, skipping`);
          stats.skipped += result.items.length;
          stats.total += result.items.length;
          continue;
        }

        console.log(`${blogsWithChangelists.length} blog posts have changelog references`);

        try {
          // Process each blog post with a changelist in parallel
          const updatePromises = blogsWithChangelists.map(async (oldBlog) => {
            try {
              // Fetch the blog from the new table
              const newBlog = await blogDao.getById(oldBlog.id!);

              if (!newBlog) {
                stats.notFound += 1;
                return;
              }

              // Check if the changelog reference is already set correctly
              if (newBlog.changelist === oldBlog.changelist) {
                stats.skipped += 1;
                return;
              }

              // Update the blog with the correct changelog reference
              newBlog.changelist = oldBlog.changelist;

              // Use update to modify the existing blog
              await blogDao.update(newBlog);

              stats.fixed += 1;
            } catch (error) {
              stats.errors += 1;
              console.error(`Error fixing blog ${oldBlog.id}:`, error);
            }
          });

          // Wait for all updates to complete
          await Promise.all(updatePromises);

          stats.total += result.items.length;
        } catch (error) {
          console.error(`Error processing batch:`, error);
          // Don't increment error count for entire batch, individual errors are tracked above
        }
      }

      console.log(
        `Batch ${batchNumber} complete - Fixed: ${stats.fixed}, Skipped: ${stats.skipped}, Not found: ${stats.notFound}, Errors: ${stats.errors}`,
      );
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Fix complete!');
    console.log(`Total blog posts processed: ${stats.total}`);
    console.log(`Successfully fixed: ${stats.fixed}`);
    console.log(`Skipped (already correct): ${stats.skipped}`);
    console.log(`Not found in new table: ${stats.notFound}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Fix failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
