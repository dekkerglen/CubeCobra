// Load Environment Variables
import 'dotenv/config';

import { UnhydratedComment } from '@utils/datatypes/Comment';
import documentClient from '@server/dynamo/documentClient';
import { CommentDynamoDao } from 'dynamo/dao/CommentDynamoDao';
import CommentModel from '@server/dynamo/models/comment';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

interface ScanResult {
  items?: UnhydratedComment[];
  lastKey?: Record<string, any>;
}

/**
 * Migration script to move comments from old DynamoDB format to new format.
 *
 * Old format (COMMENTS table):
 * - Simple table with partition key 'id'
 * - GSI on 'parent' and 'owner'
 * - Stores UnhydratedComment directly
 *
 * New format (Single table design):
 * - PK: COMMENT#{id}
 * - SK: COMMENT
 * - GSI1PK: COMMENT#PARENT#{parent}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: COMMENT#OWNER#{ownerId}
 * - GSI2SK: DATE#{date}
 */
(async () => {
  try {
    console.log('Starting comment migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const commentDao = new CommentDynamoDao(documentClient, tableName, false);

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

      // Scan the old comments table
      const result: ScanResult = await CommentModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} comments in this batch`);

        try {
          // Check which comments already exist in new format
          const existingChecks = await Promise.all(
            result.items.map(async (oldComment) => ({
              comment: oldComment,
              exists: !!(await commentDao.getById(oldComment.id!)),
            })),
          );

          // Filter to only comments that need to be migrated
          const commentsToMigrate = existingChecks
            .filter((check) => !check.exists)
            .map((check) => ({
              id: check.comment.id!,
              parent: check.comment.parent,
              type: check.comment.type,
              owner: check.comment.owner ? ({ id: check.comment.owner } as any) : undefined,
              body: check.comment.body,
              date: check.comment.date,
            }));

          const skippedCount = result.items.length - commentsToMigrate.length;
          stats.skipped += skippedCount;
          stats.total += result.items.length;

          if (commentsToMigrate.length > 0) {
            // Batch write all comments that need to be migrated
            await commentDao.batchPut(commentsToMigrate);
            stats.migrated += commentsToMigrate.length;
            console.log(`Migrated ${commentsToMigrate.length} comments, skipped ${skippedCount}`);
          } else {
            console.log(`All ${result.items.length} comments already exist, skipped`);
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
    console.log(`Total comments processed: ${stats.total}`);
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
