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
  fixed: number;
  errors: number;
}

interface Checkpoint {
  lastKey?: Record<string, any>;
  stats: MigrationStats;
  batchNumber: number;
}

const CHECKPOINT_FILE = path.join(__dirname, 'fixCubeGSI.checkpoint.json');

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
 * Script to fix GSI keys for all cubes by doing a full table scan.
 * Also fixes cubes with missing owner IDs by looking them up from the old table.
 */
(async () => {
  try {
    console.log('Starting GSI fix for all cubes via table scan');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAO
    const cubeDao = new CubeDynamoDao(documentClient, tableName, false);

    // Try to load checkpoint
    const checkpoint = loadCheckpoint();

    const stats: MigrationStats = checkpoint?.stats || {
      total: 0,
      updated: 0,
      fixed: 0,
      errors: 0,
    };

    let lastKey: Record<string, any> | undefined = checkpoint?.lastKey;
    let batchNumber = checkpoint?.batchNumber || 0;

    if (checkpoint) {
      console.log(`Resuming from checkpoint:`);
      console.log(`  Batch: ${batchNumber}`);
      console.log(`  Total cubes scanned: ${stats.total}`);
      console.log(`  Updated: ${stats.updated}`);
      console.log(`  Fixed: ${stats.fixed}`);
      console.log(`  Errors: ${stats.errors}`);
      console.log('='.repeat(80));
    }

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      try {
        // Use scanRawCubeItems to get unhydrated cubes (works even with missing owners)
        const result = await cubeDao.scanRawCubeItems(lastKey);

        console.log(`  Scan returned ${result.items?.length || 0} items`);
        console.log(`  LastKey present: ${!!result.lastKey}`);

        lastKey = result.lastKey;

        if (result.items && result.items.length > 0) {
          console.log(`  Found ${result.items.length} cube items`);

          stats.total += result.items.length;

          // Process cubes in parallel
          const updatePromises = result.items.map(async (rawCube: any) => {
            try {
              // The actual cube data is in the `item` field
              const cubeData = rawCube.item || rawCube;
              const cubeId = cubeData.id;

              // Check if owner is missing
              if (!cubeData.owner || cubeData.owner === '' || cubeData.owner === 'null') {
                console.log(`  ⚠️  Cube ${cubeId} has missing owner, looking up from old table...`);

                // Look up the cube from the old table
                const oldCube = await CubeModel.getById(cubeId);

                if (!oldCube || !oldCube.owner) {
                  console.error(`  ❌ Could not find owner for cube ${cubeId} in old table`);
                  stats.errors += 1;
                  return;
                }

                const ownerId = typeof oldCube.owner === 'string' ? oldCube.owner : oldCube.owner.id;

                // Update the cube with the correct owner and regenerate GSI keys
                const now = Date.now();
                const shard = cubeId.charCodeAt(cubeId.length - 1) % 10;

                const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
                await documentClient.send(
                  new UpdateCommand({
                    TableName: tableName,
                    Key: {
                      PK: `CUBE#${cubeId}`,
                      SK: 'CUBE',
                    },
                    UpdateExpression: `SET #item = :item,
                                          #date = :now, 
                                          dateLastUpdated = :now,
                                          GSI1PK = :gsi1pk,
                                          GSI1SK = :gsi1sk,
                                          GSI2PK = :gsi2pk,
                                          GSI2SK = :gsi2sk,
                                          GSI3PK = :gsi3pk,
                                          GSI3SK = :gsi3sk`,
                    ExpressionAttributeNames: {
                      '#item': 'item',
                      '#date': 'date',
                    },
                    ExpressionAttributeValues: {
                      ':item': {
                        ...cubeData,
                        owner: ownerId,
                      },
                      ':now': now,
                      ':gsi1pk': `CUBE#OWNER#${ownerId}`,
                      ':gsi1sk': `DATE#${now}`,
                      ':gsi2pk': cubeData.visibility ? `CUBE#VISIBILITY#${cubeData.visibility}` : undefined,
                      ':gsi2sk': `DATE#${now}`,
                      ':gsi3pk': `CUBE#${shard}`,
                      ':gsi3sk': cubeId,
                    },
                  }),
                );

                console.log(`  ✓ Fixed cube ${cubeId} with owner ${ownerId}`);
                stats.fixed += 1;
                stats.updated += 1;
              } else {
                // Owner is valid, just update GSI keys by fetching and updating the cube
                const cube = await cubeDao.getById(cubeId);

                if (!cube) {
                  console.error(`  ❌ Could not hydrate cube ${cubeId}`);
                  stats.errors += 1;
                  return;
                }

                await cubeDao.update(cube);
                stats.updated += 1;
              }

              if (stats.updated % 10 === 0) {
                console.log(`  Progress: ${stats.updated} cubes updated (${stats.fixed} fixed)`);
              }
            } catch (error) {
              console.error(`  Error updating cube ${rawCube.item?.id || 'unknown'}:`, error);
              stats.errors += 1;

              if (stats.errors > 100) {
                console.error('Too many errors, stopping fix');
                throw new Error('GSI fix failed with too many errors');
              }
            }
          });

          await Promise.all(updatePromises);
        } else {
          console.log(`  No cube items in this batch (likely all hash rows)`);
        }

        console.log(`  Batch ${batchNumber} complete. Total cubes scanned so far: ${stats.total}`);

        // Save checkpoint after each batch
        saveCheckpoint({
          lastKey,
          stats,
          batchNumber,
        });
      } catch (error) {
        console.error(`  Error processing batch:`, error);
        stats.errors += 1;

        if (stats.errors > 100) {
          console.error('Too many errors, stopping fix');
          throw new Error('GSI fix failed with too many errors');
        }
      }
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('GSI fix complete!');
    console.log(`Total cubes processed: ${stats.total}`);
    console.log(`Successfully updated: ${stats.updated}`);
    console.log(`Cubes with missing owners fixed: ${stats.fixed}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    // Clear checkpoint on successful completion
    clearCheckpoint();

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('GSI fix failed with error:');
    console.error(err);
    console.error('='.repeat(80));
    console.error('\nCheckpoint saved. You can resume by running the script again.');
    process.exit(1);
  }
})();
