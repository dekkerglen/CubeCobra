// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import CubeModel from '@server/dynamo/models/cube';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import Cube from '@utils/datatypes/Cube';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

/**
 * Migration script to move cubes from old DynamoDB format to new single-table format.
 *
 * Old format (CUBE_METADATA table):
 * - Simple table with partition key 'id'
 * - GSI on 'owner' and 'visibility'
 * - Stores cube metadata
 * - Cards stored separately in S3
 * - Hashes stored in CUBE_HASHES table
 *
 * New format (Single table design):
 * - PK: CUBE#{id}
 * - SK: CUBE
 * - GSI1PK: CUBE#OWNER#{ownerId}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: CUBE#VISIBILITY#{visibility}
 * - GSI2SK: DATE#{date}
 * - Cards still in S3 (no migration needed)
 * - Hash rows in same table with GSI keys for sorting
 *
 * Note: This script only migrates cube metadata. Cards are already in S3 and don't need migration.
 * Hash rows will be regenerated fresh, so CUBE_HASHES table is not migrated.
 */
(async () => {
  try {
    console.log('Starting cube migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);

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

      // Scan the old cube metadata table
      const result = await CubeModel.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} cubes in this batch`);

        try {
          // Check which cubes already exist in new format
          const existingChecks = await Promise.all(
            result.items.map(async (oldCube) => ({
              cube: oldCube,
              exists: !!(await cubeDao.getById(oldCube.id)),
            })),
          );

          // Filter to only cubes that need to be migrated
          const cubesToMigrate = existingChecks.filter((check) => !check.exists).map((check) => check.cube);

          const skippedCount = result.items.length - cubesToMigrate.length;
          stats.skipped += skippedCount;
          stats.total += result.items.length;

          if (cubesToMigrate.length > 0) {
            // Process cubes one at a time to handle hash generation properly
            for (const oldCube of cubesToMigrate) {
              try {
                // The old cube is already hydrated, so we can use it directly
                const cube = oldCube as Cube;

                // Put the cube with hash rows
                // Note: Cards are already in S3, no need to migrate them
                // Hash rows will be created automatically by the DAO
                await cubeDao.put(cube);

                stats.migrated += 1;

                if (stats.migrated % 10 === 0) {
                  console.log(
                    `Progress: ${stats.migrated}/${cubesToMigrate.length} migrated in this batch (${stats.total} total processed)`,
                  );
                }
              } catch (error) {
                console.error(`Error migrating cube ${oldCube.id}:`, error);
                stats.errors += 1;

                if (stats.errors > 100) {
                  console.error('Too many errors, stopping migration');
                  throw new Error('Migration failed with too many errors');
                }
              }
            }

            console.log(`Migrated ${cubesToMigrate.length} cubes, skipped ${skippedCount}`);
          } else {
            console.log(`All ${result.items.length} cubes already exist, skipped`);
          }

          console.log(
            `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
          );
        } catch (error) {
          stats.errors += result.items.length;
          console.error(`Error processing batch:`, error);

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
    console.log(`Total cubes processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Cards remain in S3 and do not need migration.');
    console.log('Note: Hash rows were created fresh during migration.');
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
