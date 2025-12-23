/**
 * Daily P1P1 Migration Script
 *
 * Migrates daily P1P1 records from the old DAILY_P1P1 table to the new single-table design.
 *
 * Prerequisites:
 * 1. Build the server package:
 *    cd packages/server && npm run build
 *
 * 2. Set environment variables:
 *    - DYNAMO_TABLE: Target single table name
 *    - AWS credentials and DynamoDB connection settings
 *
 * Usage:
 *    cd packages/scripts
 *    ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateDailyP1P1.ts
 *
 * Features:
 * - Idempotent: Can be safely run multiple times
 * - Batch processing: Handles large datasets with pagination
 * - Error handling: Stops after 100 errors to prevent data corruption
 * - Progress tracking: Real-time statistics
 * - Verification: Confirms active record migration
 */

// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import dailyP1P1Model from '@server/dynamo/models/dailyP1P1';
import { DailyP1P1 } from '@utils/datatypes/DailyP1P1';
import { DailyP1P1DynamoDao } from 'dynamo/dao/DailyP1P1DynamoDao';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

interface ScanResult {
  items?: DailyP1P1[];
  lastKey?: Record<string, any>;
}

/**
 * Migration script to move daily P1P1 records from old DynamoDB format to new format.
 *
 * Old format (DAILY_P1P1 table):
 * - Partition key: 'id'
 * - GSI 'ByDate': 'type' (PK), 'date' (SK)
 * - Simple scan for active P1P1 with filter on isActive
 *
 * New format (Single table design):
 * - PK: DAILY_P1P1#{id}
 * - SK: DAILY_P1P1
 * - GSI1PK: DAILY_P1P1#TYPE#{type}
 * - GSI1SK: DATE#{date}
 * - GSI2PK: DAILY_P1P1#ACTIVE (for active records)
 * - GSI2SK: DATE#{date}
 */
(async () => {
  try {
    console.log('Starting daily P1P1 migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAO (with dualWrite disabled since we're migrating)
    const dailyP1P1Dao = new DailyP1P1DynamoDao(documentClient, tableName, false);

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

      // Scan the old daily P1P1 table
      const result: ScanResult = await dailyP1P1Model.scan(lastKey);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} daily P1P1 records in this batch`);

        try {
          // Check which records already exist in new format
          const existingChecks = await Promise.all(
            result.items.map(async (oldRecord) => ({
              record: oldRecord,
              exists: !!(await dailyP1P1Dao.getById(oldRecord.id)),
            })),
          );

          // Filter to only records that need to be migrated
          const recordsToMigrate = existingChecks
            .filter((check) => !check.exists)
            .map((check) => {
              const record = check.record;
              // Ensure we have all required fields including dateCreated/dateLastUpdated
              const now = Date.now();
              return {
                id: record.id,
                type: record.type || 'HISTORY',
                packId: record.packId,
                cubeId: record.cubeId,
                date: record.date,
                isActive: record.isActive,
                dateCreated: record.dateCreated || record.date || now,
                dateLastUpdated: record.dateLastUpdated || record.date || now,
              };
            });

          const skippedCount = result.items.length - recordsToMigrate.length;
          stats.skipped += skippedCount;
          stats.total += result.items.length;

          if (recordsToMigrate.length > 0) {
            // Batch write all records that need to be migrated
            await dailyP1P1Dao.batchPut(recordsToMigrate);
            stats.migrated += recordsToMigrate.length;
            console.log(`Migrated ${recordsToMigrate.length} records, skipped ${skippedCount}`);

            // Log the active record if present
            const activeRecord = recordsToMigrate.find((r) => r.isActive);
            if (activeRecord) {
              console.log(
                `  Active record: ID=${activeRecord.id}, Cube=${activeRecord.cubeId}, Date=${new Date(activeRecord.date).toISOString()}`,
              );
            }
          } else {
            console.log(`All ${result.items.length} records already exist, skipped`);
          }

          console.log(
            `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
          );
        } catch (error) {
          stats.errors += result.items.length;
          console.error(`Error migrating batch:`, error);

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
    console.log(`Total daily P1P1 records processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);

    // Verify the active record
    console.log('\nVerifying active record in new format...');
    const activeRecord = await dailyP1P1Dao.getCurrentDailyP1P1();
    if (activeRecord) {
      console.log(`✓ Active record found:`);
      console.log(`  ID: ${activeRecord.id}`);
      console.log(`  Cube: ${activeRecord.cubeId}`);
      console.log(`  Pack: ${activeRecord.packId}`);
      console.log(`  Date: ${new Date(activeRecord.date).toISOString()}`);
    } else {
      console.log('⚠ No active record found in new format');
    }

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
