// Load Environment Variables
require('dotenv').config();

import { UnhydratedComment } from '@utils/datatypes/Comment';

const client = require('../../server/build/dynamo/client').default;
const { CommentDynamoDao } = require('../../server/build/dynamo/dao/CommentDynamoDao');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const CommentModel = require('../../server/build/dynamo/models/comment').default;

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

    const documentClient = DynamoDBDocumentClient.from(client);
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

    let lastKey = null;
    let batchNumber = 0;

    do {
      batchNumber++;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old comments table
      const result: ScanResult = await CommentModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} comments in this batch`);

        for (const oldComment of result.items as UnhydratedComment[]) {
          stats.total++;

          try {
            // Check if comment already exists in new format
            const existingComment = await commentDao.getById(oldComment.id!);

            if (existingComment) {
              stats.skipped++;
              if (stats.total % 100 === 0) {
                console.log(
                  `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
                );
              }
              continue;
            }

            // Create the comment in new format
            const commentToMigrate = {
              id: oldComment.id!,
              parent: oldComment.parent,
              type: oldComment.type,
              owner: oldComment.owner ? ({ id: oldComment.owner } as any) : undefined,
              body: oldComment.body,
              date: oldComment.date,
            };

            await commentDao.put(commentToMigrate);
            stats.migrated++;

            if (stats.total % 100 === 0) {
              console.log(
                `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
              );
            }
          } catch (error) {
            stats.errors++;
            console.error(`Error migrating comment ${oldComment.id}:`, error);

            if (stats.errors > 10) {
              console.error('Too many errors, stopping migration');
              throw new Error('Migration failed with too many errors');
            }
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
