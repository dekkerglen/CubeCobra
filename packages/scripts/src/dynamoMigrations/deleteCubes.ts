// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';

import 'dotenv/config';

// List of cube IDs to delete - FILL THIS OUT BEFORE RUNNING
const CUBE_IDS_TO_DELETE: string[] = [
  '55ec17e1-518d-413a-9515-368aa4a7e66e',
  'c881c3c6-eb61-4c30-bc60-7a77b5c8a20b',
  '3073a5a4-1916-4984-b2a0-6d65268bd55c',
];

interface DeletionStats {
  total: number;
  deleted: number;
  errors: number;
  notFound: number;
}

/**
 * Script to delete cubes and their associated hash rows from DynamoDB.
 *
 * This script will:
 * 1. Delete the cube metadata from the main table
 * 2. Delete all hash rows associated with the cube
 * 3. NOT delete cards from S3 (cards remain for potential recovery)
 *
 * WARNING: This is a destructive operation. Make sure you have the correct cube IDs
 * before running this script.
 */
(async () => {
  try {
    console.log('Starting cube deletion process');
    console.log('='.repeat(80));

    if (CUBE_IDS_TO_DELETE.length === 0) {
      console.log('ERROR: No cube IDs specified in CUBE_IDS_TO_DELETE array');
      console.log('Please add cube IDs to the array before running this script');
      process.exit(1);
    }

    console.log(`Will attempt to delete ${CUBE_IDS_TO_DELETE.length} cube(s):`);
    CUBE_IDS_TO_DELETE.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    console.log();

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);
    console.log();

    // Initialize the DAO
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);

    const stats: DeletionStats = {
      total: CUBE_IDS_TO_DELETE.length,
      deleted: 0,
      errors: 0,
      notFound: 0,
    };

    // Process each cube
    for (const cubeId of CUBE_IDS_TO_DELETE) {
      try {
        console.log(`Processing cube: ${cubeId}`);

        // Check if cube exists
        const cube = await cubeDao.getById(cubeId);

        if (!cube) {
          console.log(`  ⚠ Cube not found: ${cubeId}`);
          stats.notFound += 1;
          continue;
        }

        console.log(`  Found cube: ${cube.name}`);
        console.log(`  Owner: ${typeof cube.owner === 'string' ? cube.owner : cube.owner.username}`);

        // Delete the cube (this also deletes hash rows)
        await cubeDao.delete(cube);

        console.log(`  ✓ Successfully deleted cube and hash rows`);
        stats.deleted += 1;
      } catch (error) {
        console.error(`  ✗ Error deleting cube ${cubeId}:`, error);
        stats.errors += 1;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Deletion complete!');
    console.log(`Total cubes processed: ${stats.total}`);
    console.log(`Successfully deleted: ${stats.deleted}`);
    console.log(`Not found: ${stats.notFound}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\nNote: Cards in S3 (cardlist/{id}.json) were NOT deleted and can be recovered if needed.');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Deletion failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
