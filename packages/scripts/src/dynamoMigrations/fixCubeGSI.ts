// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import { CubeDynamoDao } from 'dynamo/dao/CubeDynamoDao';
import CubeModel from 'dynamo/models/cube';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  updated: number;
  hashesAdded: number;
  hashesRemoved: number;
  hashesUnchanged: number;
  hashesDeletedOld: number;
  ownersFixed: number;
  errors: number;
}

interface Checkpoint {
  lastScanKey?: Record<string, any>;
  stats: MigrationStats;
}

const CHECKPOINT_FILE = path.join(__dirname, 'fixCubeGSI.checkpoint.json');
const BATCH_SIZE = 25; // Process this many cubes in parallel

function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading checkpoint:', error);
  }
  return null;
}

function clearCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch (error) {
    console.error('Error clearing checkpoint:', error);
  }
}

/**
 * Script to repair hash rows and update GSI keys for all cubes.
 *
 * Steps for each cube:
 * 1. Query and DELETE all existing hash rows (HASH#CUBE#{id})
 * 2. Recalculate and WRITE new hash rows with correct metadata (cubeName, cubeFollowers, cubeCardCount)
 * 3. Fix owner if null/undefined
 * 4. Update cube GSI keys
 *
 * This ensures all hash rows have the correct metadata fields populated.
 *
 * Usage:
 *   - Full migration: npm run fixCubeGSI
 *   - Test mode: npm run fixCubeGSI -- --test-cube=<cubeId>
 */
(async () => {
  try {
    // Check for test mode
    const testCubeArg = process.argv.find((arg) => arg.startsWith('--test-cube='));
    const testCubeId = testCubeArg ? testCubeArg.split('=')[1] : null;

    if (testCubeId) {
      console.log('='.repeat(80));
      console.log(`TEST MODE: Processing single cube: ${testCubeId}`);
      console.log('='.repeat(80));
    } else {
      console.log('Starting cube hash repair and GSI fix');
      console.log('='.repeat(80));
    }

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAO
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);

    // TEST MODE: Process single cube
    if (testCubeId) {
      console.log(`\nProcessing test cube: ${testCubeId}`);

      try {
        // Get the cube from OLD table to verify owner
        const oldCube = await CubeModel.getById(testCubeId);
        if (!oldCube) {
          throw new Error(`Cube ${testCubeId} not found in OLD table`);
        }

        const ownerId = typeof oldCube.owner === 'string' ? oldCube.owner : oldCube.owner?.id;
        if (!ownerId) {
          throw new Error(`Cube ${testCubeId} has null/undefined owner in OLD table`);
        }

        console.log(`\nOld cube data:`);
        console.log(`  Name: ${oldCube.name}`);
        console.log(`  Owner: ${ownerId}`);
        console.log(`  Card count: ${oldCube.cardCount}`);
        console.log(`  Followers: ${oldCube.following?.length || 0}`);

        // Step 1: Get existing hash rows
        console.log(`\nStep 1: Fetching existing hash rows...`);
        const existingHashes = await cubeDao.getHashesForCube(testCubeId);
        const existingHashStrings = existingHashes.hashes.map((h) => h.hash);

        console.log(`  Found ${existingHashStrings.length} existing hash rows`);
        if (existingHashStrings.length > 0) {
          console.log(`  Sample hashes (first 5):`);
          existingHashStrings.slice(0, 5).forEach((hash, idx) => {
            const hashData = existingHashes.hashes[idx];
            console.log(`    - ${hash}`);
            console.log(`      cubeName: "${hashData?.cubeName || ''}"`);
            console.log(`      cubeFollowers: ${hashData?.cubeFollowers || 0}`);
            console.log(`      cubeCardCount: ${hashData?.cubeCardCount || 0}`);
          });
        }

        // Step 2: Delete existing hash rows
        if (existingHashStrings.length > 0) {
          console.log(`\nStep 2: Deleting ${existingHashStrings.length} existing hash rows...`);
          await (cubeDao as any).deleteHashesBySK(`CUBE#${testCubeId}`, existingHashStrings);
          console.log(`  ✓ Deleted all existing hash rows`);
        } else {
          console.log(`\nStep 2: No existing hash rows to delete`);
        }

        // Step 3: Repair hashes (recalculate and write new ones)
        console.log(`\nStep 3: Repairing hashes (recalculating and writing new ones)...`);
        const repairResult = await cubeDao.repairHashes(testCubeId, ownerId);

        console.log(`\nRepair results:`);
        console.log(`  Hashes added: ${repairResult.added}`);
        console.log(`  Hashes removed: ${repairResult.removed}`);
        console.log(`  Hashes unchanged: ${repairResult.unchanged}`);
        console.log(`  Owner fixed: ${repairResult.ownerFixed}`);

        // Step 4: Verify new hash rows
        console.log(`\nStep 4: Verifying new hash rows...`);
        const newHashes = await cubeDao.getHashesForCube(testCubeId);
        const newHashStrings = newHashes.hashes.map((h) => h.hash);

        console.log(`  Found ${newHashStrings.length} new hash rows`);
        if (newHashStrings.length > 0) {
          console.log(`  Sample new hashes (first 5):`);
          newHashStrings.slice(0, 5).forEach((hash, idx) => {
            const hashData = newHashes.hashes[idx];
            console.log(`    - ${hash}`);
            console.log(`      cubeName: "${hashData?.cubeName || ''}"`);
            console.log(`      cubeFollowers: ${hashData?.cubeFollowers || 0}`);
            console.log(`      cubeCardCount: ${hashData?.cubeCardCount || 0}`);
          });
        }

        // Step 5: Update GSI keys
        if (!repairResult.ownerFixed) {
          console.log(`\nStep 5: Updating GSI keys...`);
          await cubeDao.updateRaw(testCubeId, { dateLastUpdated: Date.now() });
          console.log(`  ✓ GSI keys updated`);
        } else {
          console.log(`\nStep 5: GSI keys already updated (owner was fixed)`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✓ TEST COMPLETE - Cube processed successfully!');
        console.log('='.repeat(80));

        process.exit(0);
      } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('❌ TEST FAILED:');
        console.error(error);
        console.error('='.repeat(80));
        process.exit(1);
      }
    }

    // FULL MIGRATION MODE
    // Try to load checkpoint
    const checkpoint = loadCheckpoint();

    const stats: MigrationStats = checkpoint?.stats || {
      total: 0,
      updated: 0,
      hashesAdded: 0,
      hashesRemoved: 0,
      hashesUnchanged: 0,
      hashesDeletedOld: 0,
      ownersFixed: 0,
      errors: 0,
    };

    let lastScanKey: Record<string, any> | undefined = checkpoint?.lastScanKey;

    if (checkpoint) {
      console.log(`Resuming from checkpoint:`);
      console.log(`  Total processed so far: ${stats.updated} cubes`);
      console.log(`  Errors so far: ${stats.errors}`);
      console.log('='.repeat(80));
    }

    // Scan OLD cube table and process cubes as we go
    console.log('\nScanning OLD cube table and repairing cubes in batches...');
    let scanBatch = 0;

    do {
      scanBatch += 1;
      console.log(`\nScan batch ${scanBatch}:`);

      // Scan a page from the old table
      const scanResult = await CubeModel.scan(lastScanKey);

      if (!scanResult.items || scanResult.items.length === 0) {
        console.log('  No cubes found in this batch');
        lastScanKey = scanResult.lastKey;
        continue;
      }

      // Create a map of cubeId -> oldCube for quick lookup when we need to fix owner
      const oldCubesById = new Map(scanResult.items.map((item: any) => [item.id, item]));

      const cubeIds = scanResult.items.map((item: any) => item.id);
      console.log(`  Found ${cubeIds.length} cubes to process`);

      stats.total += cubeIds.length;

      // Process cubes from this scan page in parallel batches
      for (let i = 0; i < cubeIds.length; i += BATCH_SIZE) {
        const batch = cubeIds.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(cubeIds.length / BATCH_SIZE);

        console.log(
          `  Processing batch ${batchNumber}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, cubeIds.length)} of ${cubeIds.length}):`,
        );

        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (cubeId) => {
            try {
              // Pre-check: Always verify owner exists in OLD table
              const oldCube = oldCubesById.get(cubeId);
              if (!oldCube) {
                throw new Error(`Cube ${cubeId} not found in OLD table`);
              }
              if (!oldCube.owner) {
                throw new Error(`Cube ${cubeId} has null/undefined owner in OLD table`);
              }

              // Step 1: Delete ALL existing hash rows for this cube
              const existingHashes = await cubeDao.getHashesForCube(cubeId);
              const existingHashStrings = existingHashes.hashes.map((h) => h.hash);

              if (existingHashStrings.length > 0) {
                // Delete all existing hashes using the private method through repairHashes
                // We'll use the delete method directly by calling it through the DAO
                await (cubeDao as any).deleteHashesBySK(`CUBE#${cubeId}`, existingHashStrings);
              }

              // Step 2: Repair hashes - this will recalculate and write new hashes
              // It will also fix the owner if it's missing
              const repairResult = await cubeDao.repairHashes(cubeId, oldCube.owner);

              if (repairResult.ownerFixed) {
                console.log(`    🔧 Fixed owner for ${cubeId}`);
              }

              // Do a no-op update to regenerate GSI keys
              // Note: We skip this if owner was fixed because repairHashes already did an update
              // and we want to avoid calling getById which might fail if there are other issues
              if (!repairResult.ownerFixed) {
                // Use updateRaw to do a no-op update that regenerates GSI keys
                // We just re-set a field to trigger the update
                await cubeDao.updateRaw(cubeId, { dateLastUpdated: Date.now() });
              }

              return {
                cubeId,
                added: repairResult.added,
                removed: repairResult.removed,
                unchanged: repairResult.unchanged,
                ownerFixed: repairResult.ownerFixed,
                deletedOld: existingHashStrings.length,
              };
            } catch (error) {
              throw { cubeId, error };
            }
          }),
        );

        // Process results
        let batchErrors = 0;
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const { cubeId, added, removed, unchanged, ownerFixed, deletedOld } = result.value;
            stats.updated += 1;
            stats.hashesAdded += added;
            stats.hashesRemoved += removed;
            stats.hashesUnchanged += unchanged;
            stats.hashesDeletedOld += deletedOld;
            if (ownerFixed) {
              stats.ownersFixed += 1;
            }

            if (ownerFixed) {
              console.log(
                `    ✓ ${cubeId}: OWNER FIXED, deleted ${deletedOld} old, +${added} -${removed} =${unchanged} hashes`,
              );
            } else if (added > 0 || removed > 0 || deletedOld > 0) {
              console.log(`    ✓ ${cubeId}: deleted ${deletedOld} old, +${added} -${removed} =${unchanged} hashes`);
            }
          } else {
            const { cubeId, error } = result.reason;
            stats.errors += 1;
            batchErrors += 1;
            console.error(`    ❌ ${cubeId}: ${error.message || error}`);
          }
        }

        // Check if this batch had an unusual number of errors
        if (batchErrors > BATCH_SIZE / 2) {
          throw new Error(`Batch had ${batchErrors}/${BATCH_SIZE} errors, stopping migration`);
        }
      }

      lastScanKey = scanResult.lastKey;

      console.log(
        `  Scan batch ${scanBatch} complete: ${stats.updated}/${stats.total} cubes processed, ${stats.errors} errors`,
      );

      // Save checkpoint after each scan page
      saveCheckpoint({
        lastScanKey,
        stats,
      });
    } while (lastScanKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total cubes: ${stats.total}`);
    console.log(`Successfully updated: ${stats.updated}`);
    console.log(`Owners fixed: ${stats.ownersFixed}`);
    console.log(`Total old hashes deleted: ${stats.hashesDeletedOld}`);
    console.log(`Total hashes added: ${stats.hashesAdded}`);
    console.log(`Total hashes removed: ${stats.hashesRemoved}`);
    console.log(`Total hashes unchanged: ${stats.hashesUnchanged}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    // Clear checkpoint on successful completion
    clearCheckpoint();

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    console.error('\nCheckpoint saved. You can resume by running the script again.');
    process.exit(1);
  }
})();
