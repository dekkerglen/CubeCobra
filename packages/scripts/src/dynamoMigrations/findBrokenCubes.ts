// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';

import 'dotenv/config';

/**
 * Script to find cubes with missing or invalid data.
 */
(async () => {
  try {
    console.log('Scanning for cubes with data issues');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAO
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);

    const issues = {
      missingOwner: [] as string[],
      missingId: [] as string[],
      other: [] as string[],
    };

    let lastKey: Record<string, any> | undefined;
    let batchNumber = 0;
    let totalScanned = 0;

    do {
      batchNumber += 1;
      console.log(`\nScanning batch ${batchNumber}...`);

      const result = await cubeDao.scanRawCubeItems(lastKey);

      console.log(`  Found ${result.items?.length || 0} cube items`);

      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        totalScanned += result.items.length;

        for (const item of result.items) {
          if (!item.owner || item.owner === '' || item.owner === 'null') {
            console.log(`  ⚠️  Cube ${item.id || 'UNKNOWN'} has missing/invalid owner: "${item.owner}"`);
            issues.missingOwner.push(item.id || 'UNKNOWN_ID');
          }

          if (!item.id || item.id === '' || item.id === 'null') {
            console.log(`  ⚠️  Cube has missing/invalid ID`);
            issues.missingId.push(item.owner || 'UNKNOWN_OWNER');
          }
        }
      }
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Scan complete!');
    console.log(`Total cubes scanned: ${totalScanned}`);
    console.log(`Cubes with missing owner: ${issues.missingOwner.length}`);
    console.log(`Cubes with missing ID: ${issues.missingId.length}`);

    if (issues.missingOwner.length > 0) {
      console.log('\nCubes with missing owner:');
      issues.missingOwner.forEach((id) => console.log(`  - ${id}`));
    }

    if (issues.missingId.length > 0) {
      console.log('\nCubes with missing ID (owner shown):');
      issues.missingId.forEach((owner) => console.log(`  - ${owner}`));
    }

    console.log('='.repeat(80));

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Scan failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    process.exit(1);
  }
})();
