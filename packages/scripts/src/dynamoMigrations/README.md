# DynamoDB Migration Scripts

This directory contains migration scripts for transitioning data from old DynamoDB table formats to the new single-table design.

## Daily P1P1 Migration

### Overview

The `migrateDailyP1P1.ts` script migrates daily P1P1 data from the old DAILY_P1P1 table format to the new single-table design used by `DailyP1P1DynamoDao`.

### Old Format (DAILY_P1P1 table)

- Partition key: `id` (String)
- GSI `ByDate`: `type` (PK), `date` (SK)
- Scan with filter for active P1P1 records
- Direct storage of `DailyP1P1` objects

### New Format (Single Table Design)

- Partition key: `PK` = `DAILY_P1P1#{id}`
- Sort key: `SK` = `DAILY_P1P1`
- GSI1: `GSI1PK` = `DAILY_P1P1#TYPE#{type}`, `GSI1SK` = `DATE#{date}` (for history queries)
- GSI2: `GSI2PK` = `DAILY_P1P1#ACTIVE`, `GSI2SK` = `DATE#{date}` (for active record queries)

### Running the Migration

```bash
cd packages/scripts
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateDailyP1P1.ts
```

### What the Script Does

1. **Scans** all daily P1P1 records from the old DAILY_P1P1 table in batches
2. **Checks** if each record already exists in the new format (to support resume on failure)
3. **Migrates** records that don't exist in the new format, ensuring `dateCreated` and `dateLastUpdated` are set
4. **Verifies** the active record exists in the new format
5. **Reports** progress and provides a final summary

## Comment Migration

### Overview

The `migrateComments.ts` script migrates comment data from the old COMMENTS table format to the new single-table design used by `CommentDynamoDao`.

### Old Format (COMMENTS table)

- Partition key: `id` (String)
- GSI `ByParent`: `parent` (PK), `date` (SK)
- GSI `ByOwner`: `owner` (PK), `date` (SK)
- Direct storage of `UnhydratedComment` objects

### New Format (Single Table Design)

- Partition key: `PK` = `COMMENT#{id}`
- Sort key: `SK` = `COMMENT`
- GSI1: `GSI1PK` = `COMMENT#PARENT#{parent}`, `GSI1SK` = `DATE#{date}`
- GSI2: `GSI2PK` = `COMMENT#OWNER#{ownerId}`, `GSI2SK` = `DATE#{date}`

## Prerequisites

1. Build the server package first:

   ```bash
   cd packages/server
   npm run build
   ```

2. Set up environment variables:
   - `DYNAMO_TABLE`: The target single table name
   - Other AWS/DynamoDB connection settings as needed

## Running the Migration

```bash
cd packages/scripts
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateComments.ts
```

### What the Script Does

1. **Scans** all comments from the old COMMENTS table in batches
2. **Checks** if each comment already exists in the new format (to support resume on failure)
3. **Migrates** comments that don't exist in the new format
4. **Reports** progress every 100 items and provides a final summary

### Safety Features

- **Idempotent**: Can be run multiple times safely - skips already migrated comments
- **Error handling**: Stops after 10 errors to prevent data corruption
- **Progress tracking**: Shows running count of migrated/skipped/errored items
- **Batch processing**: Processes comments in batches with pagination support

### Example Output

```
Starting comment migration from old format to new DynamoDB format
================================================================================
Target table: cube-cobra-single-table

Processing batch 1...
Found 1000 comments in this batch
Progress: 100 processed (0 skipped, 100 migrated, 0 errors)
Progress: 200 processed (0 skipped, 200 migrated, 0 errors)
...
Batch 1 complete. Stats: 1000 migrated, 0 skipped, 0 errors

Processing batch 2...
...

================================================================================
Migration complete!
Total comments processed: 5432
Successfully migrated: 5432
Skipped (already exists): 0
Errors: 0
================================================================================
```

## Troubleshooting

- **"Cannot find module"**: Make sure to build the server package first
- **"DYNAMO_TABLE must be defined"**: Set the environment variable in your `.env` file
- **Too many errors**: Check AWS credentials, table permissions, and DynamoDB configuration
- **Script hangs**: Check network connectivity to DynamoDB and ensure pagination is working

## Post-Migration

After successful migration:

1. Verify data integrity by spot-checking comments in both tables
2. Test the application with the new `CommentDynamoDao`
3. Monitor for any issues before removing the old COMMENTS table
4. Consider keeping dual-write mode enabled temporarily as a safety measure
