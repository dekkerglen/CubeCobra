// Load Environment Variables
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
// Configure dotenv with explicit path to jobs package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

import { packageDao } from '@server/dynamo/daos';
import { initializeCardDb } from '@server/serverutils/cardCatalog';

const privateDir = path.join(__dirname, '..', '..', 'server', 'private');

interface RepairStats {
  packagesProcessed: number;
  packagesWithChanges: number;
  totalAdded: number;
  totalRemoved: number;
  totalUnchanged: number;
  errors: number;
}

const repairPackage = async (packageId: string, stats: RepairStats): Promise<void> => {
  try {
    const result = await packageDao.repairHashes(packageId);

    stats.packagesProcessed += 1;

    if (result.added > 0 || result.removed > 0) {
      stats.packagesWithChanges += 1;
      console.log(`Repaired package ${packageId}: +${result.added} -${result.removed} =${result.unchanged}`);
    }

    stats.totalAdded += result.added;
    stats.totalRemoved += result.removed;
    stats.totalUnchanged += result.unchanged;
  } catch (err: any) {
    stats.errors += 1;
    console.error(`Error repairing package ${packageId}: ${err.message}`);
  }
};

const repairSinglePackage = async (packageId: string): Promise<void> => {
  console.log(`Repairing hashes for package: ${packageId}`);

  const stats: RepairStats = {
    packagesProcessed: 0,
    packagesWithChanges: 0,
    totalAdded: 0,
    totalRemoved: 0,
    totalUnchanged: 0,
    errors: 0,
  };

  try {
    const pkg = await packageDao.getById(packageId);

    if (!pkg) {
      console.error(`Package not found: ${packageId}`);
      process.exit(1);
    }

    await repairPackage(pkg.id, stats);

    console.log('\n=== Package Hash Repair Complete ===');
    console.log(`Package: ${pkg.title} (${pkg.id})`);
    console.log(`Hashes added: ${stats.totalAdded}`);
    console.log(`Hashes removed: ${stats.totalRemoved}`);
    console.log(`Hashes unchanged: ${stats.totalUnchanged}`);

    if (stats.errors > 0) {
      console.error('\nError occurred during repair');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during package hash repair:', err);
    process.exit(1);
  }

  process.exit(0);
};

const repairAllPackages = async (): Promise<void> => {
  console.log('Starting package hash repair job for all packages...');

  const stats: RepairStats = {
    packagesProcessed: 0,
    packagesWithChanges: 0,
    totalAdded: 0,
    totalRemoved: 0,
    totalUnchanged: 0,
    errors: 0,
  };

  let batchNumber = 0;
  let lastKey: Record<string, any> | undefined = undefined;

  try {
    do {
      batchNumber += 1;
      const batchStartTime = Date.now();

      // Enumerate via a base-table scan rather than queryAllPackages: the latter
      // reads the 'package:all' hash rows, so it can't see packages whose hash
      // rows are missing — exactly the ones a repair run needs to fix.
      const result = await packageDao.scanAllPackageIds(lastKey, 100);

      console.log(`\nProcessing batch ${batchNumber} (${result.packageIds.length} packages)...`);

      await Promise.all(result.packageIds.map((packageId) => repairPackage(packageId, stats)));

      const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(
        `Batch ${batchNumber} complete in ${batchDuration}s. ` +
          `Progress: ${stats.packagesProcessed} packages, ${stats.packagesWithChanges} with changes, ${stats.errors} errors`,
      );

      lastKey = result.lastKey;
    } while (lastKey);

    console.log('\n=== Package Hash Repair Complete ===');
    console.log(`Packages processed: ${stats.packagesProcessed}`);
    console.log(`Packages with changes: ${stats.packagesWithChanges}`);
    console.log(`Total hashes added: ${stats.totalAdded}`);
    console.log(`Total hashes removed: ${stats.totalRemoved}`);
    console.log(`Total hashes unchanged: ${stats.totalUnchanged}`);
    console.log(`Errors: ${stats.errors}`);

    if (stats.errors > 0) {
      console.warn(`\nWarning: ${stats.errors} packages failed to process. Check logs above for details.`);
    }
  } catch (err: any) {
    console.error('Fatal error during package hash repair:', err);
    process.exit(1);
  }

  process.exit(0);
};

(async () => {
  await initializeCardDb(privateDir);
  console.log('Card database initialized');

  const packageIdFromEnv = process.env.PACKAGE_ID;
  const args = process.argv;
  const packageIdArg = args.find((arg) => arg.startsWith('--packageid='));

  let packageId: string | undefined;

  if (packageIdFromEnv) {
    packageId = packageIdFromEnv.trim();
    console.log('Using PACKAGE_ID from environment variable');
  } else if (packageIdArg) {
    packageId = packageIdArg.split('=')[1]?.trim();
  }

  if (packageId) {
    console.log(`\nRunning in single-package mode for package: ${packageId}\n`);
    await repairSinglePackage(packageId);
  } else {
    console.log('\nRunning in all-packages mode (no PACKAGE_ID env var or --packageid argument found)\n');
    await repairAllPackages();
  }
})();
