/**
 * Migration script to add package:all hash to all existing packages.
 * This enables the new query system to find all packages.
 */

import { Sha256 } from '@aws-crypto/sha256-js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// @ts-ignore - using old model for scan operation
import packageModel from '../../server/src/dynamo/models/package';
import { initializeCardDb } from '../../server/src/serverutils/cardCatalog';
import { cardFromId } from '../../server/src/serverutils/carddb';

// Initialize DynamoDB client
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: 'us-east-2',
  }),
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  },
);

const TABLE_NAME = 'PROD_CUBECOBRA';

/**
 * Calculate hash using the same algorithm as BaseDynamoDao
 */
async function calculateHash(data: Record<string, string>): Promise<string> {
  data.ItemType = 'PACKAGE';

  const list = Object.entries(data)
    .map(([key, value]) => `${key}:${value}`)
    .sort();

  const hash = new Sha256();
  hash.update(list.join(','));
  const raw = await hash.digest();
  return Array.from(raw)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function migratePackageHashes() {
  console.log('Starting package hash migration...');
  console.log(`Using table: ${TABLE_NAME}`);

  let processedCount = 0;
  let skippedCount = 0;
  let lastKey: any = undefined;
  let hasMore = true;

  // Calculate the package:all hash using the same algorithm as the DAO
  const globalHash = await calculateHash({ type: 'package', value: 'all' });

  console.log(`Global hash (package:all): ${globalHash}`);

  while (hasMore) {
    // Scan all packages using the old model
    const result = await packageModel.scan(lastKey);

    if (!result.items || result.items.length === 0) {
      console.log('No more packages to process');
      break;
    }

    console.log(`Processing batch of ${result.items.length} packages...`);

    // Process packages one at a time and accumulate hash rows
    // Each package creates multiple hash rows (package:all + user + cards)
    // DynamoDB batch write has a hard limit of 25 items per request
    const MAX_BATCH_SIZE = 25;
    let hashRows: any[] = [];

    for (const pkg of result.items) {
      try {
        const packagePK = `PACKAGE#${pkg.id}`;
        const hashPK = `HASH#${packagePK}`;

        const baseHashRow = {
          packageTitle: pkg.title,
          packageVoteCount: pkg.voteCount || 0,
          packageDate: pkg.date || Date.now(),
        };

        const currentPackageHashRows: any[] = [];

        // Create the package:all hash row
        currentPackageHashRows.push({
          PK: hashPK,
          SK: globalHash,
          GSI1PK: globalHash,
          GSI1SK: `VOTES#${String(pkg.voteCount || 0).padStart(10, '0')}`,
          GSI2PK: globalHash,
          GSI2SK: `DATE#${String(pkg.date || Date.now()).padStart(15, '0')}`,
          ...baseHashRow,
        });

        // Create user hash row if package has an owner
        if (pkg.owner) {
          const userHash = await calculateHash({ type: 'user', value: pkg.owner });
          currentPackageHashRows.push({
            PK: hashPK,
            SK: userHash,
            GSI1PK: userHash,
            GSI1SK: `VOTES#${String(pkg.voteCount || 0).padStart(10, '0')}`,
            GSI2PK: userHash,
            GSI2SK: `DATE#${String(pkg.date || Date.now()).padStart(15, '0')}`,
            ...baseHashRow,
          });
        }

        // Create hash rows for each card in the package
        if (Array.isArray(pkg.cards)) {
          const processedOracleIds = new Set<string>();

          for (const cardItem of pkg.cards) {
            try {
              // Handle both string IDs and hydrated card objects
              let card;
              if (typeof cardItem === 'string') {
                // Card is stored as ID string
                card = cardFromId(cardItem);
              } else if (
                cardItem &&
                typeof cardItem === 'object' &&
                Object.prototype.hasOwnProperty.call(cardItem, 'oracle_id')
              ) {
                // Card is already hydrated - use it directly
                card = cardItem;
              } else {
                console.log(`Skipping invalid card in package ${pkg.id}`);
                continue;
              }

              if (card && card.oracle_id && !processedOracleIds.has(card.oracle_id)) {
                processedOracleIds.add(card.oracle_id);

                const oracleHash = await calculateHash({ type: 'oracle', value: card.oracle_id });
                currentPackageHashRows.push({
                  PK: hashPK,
                  SK: oracleHash,
                  GSI1PK: oracleHash,
                  GSI1SK: `VOTES#${String(pkg.voteCount || 0).padStart(10, '0')}`,
                  GSI2PK: oracleHash,
                  GSI2SK: `DATE#${String(pkg.date || Date.now()).padStart(15, '0')}`,
                  ...baseHashRow,
                });
              }
            } catch (error) {
              console.error(`Error processing card in package ${pkg.id}:`, error);
            }
          }
        }

        // If current package has more than 25 hash rows, write them directly in chunks
        if (currentPackageHashRows.length > MAX_BATCH_SIZE) {
          // First, flush any accumulated hash rows
          if (hashRows.length > 0) {
            try {
              await dynamoClient.send(
                new BatchWriteCommand({
                  RequestItems: {
                    [TABLE_NAME]: hashRows.map((hashRow) => ({
                      PutRequest: {
                        Item: hashRow,
                      },
                    })),
                  },
                }),
              );
            } catch (error) {
              console.error(`Error writing hash batch:`, error);
              skippedCount += hashRows.length;
            }
            hashRows = [];
          }

          // Write this package's hash rows in chunks of 25
          for (let i = 0; i < currentPackageHashRows.length; i += MAX_BATCH_SIZE) {
            const chunk = currentPackageHashRows.slice(i, i + MAX_BATCH_SIZE);
            try {
              await dynamoClient.send(
                new BatchWriteCommand({
                  RequestItems: {
                    [TABLE_NAME]: chunk.map((hashRow) => ({
                      PutRequest: {
                        Item: hashRow,
                      },
                    })),
                  },
                }),
              );
            } catch (error) {
              console.error(`Error writing large package hash batch:`, error);
              skippedCount += chunk.length;
            }
          }
        } else {
          // Check if adding current package's hash rows would exceed batch limit
          if (hashRows.length + currentPackageHashRows.length > MAX_BATCH_SIZE) {
            // Write accumulated batch before adding this package's hashes
            if (hashRows.length > 0) {
              try {
                await dynamoClient.send(
                  new BatchWriteCommand({
                    RequestItems: {
                      [TABLE_NAME]: hashRows.map((hashRow) => ({
                        PutRequest: {
                          Item: hashRow,
                        },
                      })),
                    },
                  }),
                );
              } catch (error) {
                console.error(`Error writing hash batch:`, error);
                skippedCount += hashRows.length;
              }
              hashRows = [];
            }
          }

          // Add current package's hash rows to batch
          hashRows.push(...currentPackageHashRows);
        }

        processedCount += 1;

        if (processedCount % 50 === 0) {
          console.log(`Processed ${processedCount} packages so far...`);
        }
      } catch (error) {
        console.error(`Error preparing hash for package ${pkg.id}:`, error);
        skippedCount += 1;
      }
    }

    // Write any remaining hash rows
    if (hashRows.length > 0) {
      try {
        await dynamoClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: hashRows.map((hashRow) => ({
                PutRequest: {
                  Item: hashRow,
                },
              })),
            },
          }),
        );
      } catch (error) {
        console.error(`Error writing final hash batch:`, error);
        skippedCount += hashRows.length;
      }
    }

    lastKey = result.lastKey;
    hasMore = !!lastKey;
  }

  console.log(`\nMigration complete!`);
  console.log(`Processed ${processedCount} packages`);
  console.log(`Skipped ${skippedCount} packages due to errors`);
}

// Run the migration
async function main() {
  console.log('Loading card database from server/private...');
  await initializeCardDb('../server/private');
  console.log('Card database loaded!\n');

  await migratePackageHashes();
}

main()
  .then(() => {
    console.log('Migration finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
