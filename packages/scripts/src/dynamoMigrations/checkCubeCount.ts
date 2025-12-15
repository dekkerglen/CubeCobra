// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import CubeModel from '@server/dynamo/models/cube';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';

import 'dotenv/config';

/**
 * Quick script to check cube counts in old vs new table
 */
(async () => {
  try {
    console.log('Checking cube counts...');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    // Count cubes in old table
    let oldCount = 0;
    let lastKey: Record<string, any> | undefined;

    console.log('Scanning old CUBE_METADATA table...');
    do {
      const result = await CubeModel.scan(lastKey);
      oldCount += result.items?.length || 0;
      lastKey = result.lastKey;
      console.log(`  Old table: ${oldCount} cubes found so far...`);
    } while (lastKey);

    console.log(`\nOld table total: ${oldCount} cubes`);

    // Count cubes in new table
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);
    let newCount = 0;
    let newLastKey: Record<string, any> | undefined;

    console.log('\nScanning new single table for cubes...');
    do {
      const result = await cubeDao.scanCubeItems(newLastKey);
      newCount += result.items?.length || 0;
      newLastKey = result.lastKey;
      console.log(`  New table: ${newCount} cubes found so far...`);
    } while (newLastKey);

    console.log(`\nNew table total: ${newCount} cubes`);
    console.log(`\nDifference: ${oldCount - newCount} cubes not migrated`);

    console.log('='.repeat(80));
    process.exit(0);
  } catch (err) {
    console.error('Failed with error:');
    console.error(err);
    process.exit(1);
  }
})();
