// Load Environment Variables
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
// Configure dotenv with explicit path to jobs package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

import { cubeDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import type Cube from '@utils/datatypes/Cube';

const privateDir = path.join(__dirname, '..', '..', 'server', 'private');

interface RepairStats {
  cubesProcessed: number;
  cubesWithChanges: number;
  totalAdded: number;
  totalRemoved: number;
  totalUnchanged: number;
  ownersFixed: number;
  errors: number;
}

/**
 * Repairs hashes for a single cube by fetching current hashes,
 * calculating expected hashes (including oracle hashes from cards),
 * and writing the delta.
 */
const repairCubeHashes = async (cube: Cube, stats: RepairStats): Promise<void> => {
  try {
    // Use the repairHashes method which handles both metadata and card hashes
    const result = await cubeDao.repairHashes(cube.id);

    stats.cubesProcessed += 1;

    if (result.added > 0 || result.removed > 0) {
      stats.cubesWithChanges += 1;
      console.log(
        `Repaired cube ${cube.id} (${cube.name}): +${result.added} -${result.removed} =${result.unchanged}${result.ownerFixed ? ' [owner fixed]' : ''}`,
      );
    }

    stats.totalAdded += result.added;
    stats.totalRemoved += result.removed;
    stats.totalUnchanged += result.unchanged;

    if (result.ownerFixed) {
      stats.ownersFixed += 1;
    }
  } catch (err: any) {
    stats.errors += 1;
    console.error(`Error repairing cube ${cube.id}: ${err.message}`);
  }
};

/**
 * Repairs hashes for a single cube by ID.
 */
const repairSingleCube = async (cubeId: string): Promise<void> => {
  console.log(`Repairing hashes for cube: ${cubeId}`);

  const stats: RepairStats = {
    cubesProcessed: 0,
    cubesWithChanges: 0,
    totalAdded: 0,
    totalRemoved: 0,
    totalUnchanged: 0,
    ownersFixed: 0,
    errors: 0,
  };

  try {
    const cube = await cubeDao.getById(cubeId);

    if (!cube) {
      console.error(`Cube not found: ${cubeId}`);
      process.exit(1);
    }

    await repairCubeHashes(cube, stats);

    console.log('\n=== Cube Hash Repair Complete ===');
    console.log(`Cube: ${cube.name} (${cube.id})`);
    console.log(`Hashes added: ${stats.totalAdded}`);
    console.log(`Hashes removed: ${stats.totalRemoved}`);
    console.log(`Hashes unchanged: ${stats.totalUnchanged}`);
    if (stats.ownersFixed > 0) {
      console.log(`Owner fixed: Yes`);
    }

    if (stats.errors > 0) {
      console.error('\nError occurred during repair');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during cube hash repair:', err);
    process.exit(1);
  }

  process.exit(0);
};

/**
 * Repairs hashes for all cubes.
 */
const repairAllCubes = async (): Promise<void> => {
  console.log('Starting cube hash repair job for all cubes...');

  const stats: RepairStats = {
    cubesProcessed: 0,
    cubesWithChanges: 0,
    totalAdded: 0,
    totalRemoved: 0,
    totalUnchanged: 0,
    ownersFixed: 0,
    errors: 0,
  };

  let batchNumber = 0;
  let lastKey: Record<string, any> | undefined = undefined;

  try {
    // Iterate through all cubes using queryAllCubes with pagination
    do {
      batchNumber += 1;
      const batchStartTime = Date.now();

      // Query a batch of cubes
      const result = await cubeDao.queryAllCubes('date', false, lastKey);

      console.log(`\nProcessing batch ${batchNumber} (${result.items.length} cubes)...`);

      // Process all cubes in the batch in parallel
      await Promise.all(result.items.map((cube) => repairCubeHashes(cube, stats)));

      const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(
        `Batch ${batchNumber} complete in ${batchDuration}s. ` +
          `Progress: ${stats.cubesProcessed} cubes, ${stats.cubesWithChanges} with changes, ${stats.errors} errors`,
      );

      lastKey = result.lastKey;
    } while (lastKey);

    console.log('\n=== Cube Hash Repair Complete ===');
    console.log(`Cubes processed: ${stats.cubesProcessed}`);
    console.log(`Cubes with changes: ${stats.cubesWithChanges}`);
    console.log(`Total hashes added: ${stats.totalAdded}`);
    console.log(`Total hashes removed: ${stats.totalRemoved}`);
    console.log(`Total hashes unchanged: ${stats.totalUnchanged}`);
    console.log(`Owners fixed: ${stats.ownersFixed}`);
    console.log(`Errors: ${stats.errors}`);

    if (stats.errors > 0) {
      console.warn(`\nWarning: ${stats.errors} cubes failed to process. Check logs above for details.`);
    }
  } catch (err: any) {
    console.error('Fatal error during cube hash repair:', err);
    process.exit(1);
  }

  process.exit(0);
};

(async () => {
  await initializeCardDb(privateDir);
  console.log('Card database initialized');

  // Check for CUBE_ID environment variable first, then command-line arguments
  const cubeIdFromEnv = process.env.CUBE_ID;
  const args = process.argv;
  const cubeIdArg = args.find((arg) => arg.startsWith('--cubeid='));

  let cubeId: string | undefined;

  if (cubeIdFromEnv) {
    cubeId = cubeIdFromEnv.trim();
    console.log('Using CUBE_ID from environment variable');
  } else if (cubeIdArg) {
    cubeId = cubeIdArg.split('=')[1]?.trim();
  }

  if (cubeId) {
    // Single cube mode
    if (!cubeId) {
      console.error('Error: CUBE_ID or --cubeid argument requires a value');
      process.exit(1);
    }
    console.log(`\nRunning in single-cube mode for cube: ${cubeId}\n`);
    await repairSingleCube(cubeId);
  } else {
    // All cubes mode
    console.log('\nRunning in all-cubes mode (no CUBE_ID env var or --cubeid argument found)\n');
    await repairAllCubes();
  }
})();
