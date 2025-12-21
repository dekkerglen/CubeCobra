// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import CubeModel from '@server/dynamo/models/cube';
import Cube from '@utils/datatypes/Cube';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import { UserDynamoDao } from 'dynamo/dao/UserDynamoDao';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  migrated: number;
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
    const userDao = new UserDynamoDao(documentClient, tableName, false);
    const cubeDao = new CubeDynamoDao(documentClient, userDao, tableName, false);

    const stats: MigrationStats = {
      total: 0,
      migrated: 0,
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
        console.log(`Found ${result.items.length} cubes in this batch - will update/create entries`);

        try {
          stats.total += result.items.length;

          // Process cubes individually to ensure hash rows are properly updated
          for (const oldCube of result.items) {
            try {
              const cube = oldCube as Cube;

              // Check if cube exists in new format
              const existingCube = await cubeDao.getById(cube.id);

              if (existingCube) {
                // Update existing cube - this will handle hash row updates
                await cubeDao.update(cube);
              } else {
                // Create new cube with hash rows
                const cards = await cubeDao.getCards(cube.id);
                await cubeDao.putNewCube(cube, cards);
              }

              stats.migrated += 1;

              if (stats.migrated % 10 === 0) {
                console.log(
                  `Progress: ${stats.migrated}/${result.items.length} migrated in this batch (${stats.total} total processed)`,
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

          console.log(`Migrated ${result.items.length} cubes (updated/created entries)`);

          console.log(`Progress: ${stats.total} processed (${stats.migrated} migrated, ${stats.errors} errors)`);
        } catch (error) {
          stats.errors += result.items.length;
          console.error(`Error processing batch:`, error);

          if (stats.errors > 100) {
            console.error('Too many errors, stopping migration');
            throw new Error('Migration failed with too many errors');
          }
        }
      }

      console.log(`Batch ${batchNumber} complete. Stats: ${stats.migrated} migrated, ${stats.errors} errors`);
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total cubes processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n' + 'Note: Cards remain in S3 and do not need migration.');
    console.log('Note: Hash rows were created fresh during migration.');
    console.log('Note: All existing cubes were overwritten.');
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
