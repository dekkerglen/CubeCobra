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

## Feed Migration

### Overview

The `migrateFeed.ts` script migrates feed data from the old FEED table format to the new single-table design used by `FeedDynamoDao`.

### Old Format (FEED table)

- Partition key: `id` (String) - the blog post ID
- Sort key: `to` (String) - the user ID
- GSI `ByTo`: `to` (PK), `date` (SK)
- Direct storage of feed items

### New Format (Single Table Design)

- Partition key: `PK` = `FEED#{id}`
- Sort key: `SK` = `FEED#TO#{to}`
- GSI1: `GSI1PK` = `FEED#TO#{to}`, `GSI1SK` = `DATE#{date}` (for user feed queries)

### Running the Migration

```bash
cd packages/scripts
npx tsx src/dynamoMigrations/migrateFeed.ts
```

### What the Script Does

1. **Scans** all feed items from the old FEED table in batches of 200
2. **Validates** required fields (id, to, date, type)
3. **Hydrates** blog post data using `blogDao.getById()`
4. **Migrates** using `feedDao.batchPutUnhydrated()` with dual writes enabled
5. **Checkpoints** progress after each batch to `migrateFeed-checkpoint.json`
6. **Handles** missing blog posts gracefully (skips with warning)
7. **Reports** progress and provides a final summary

### Safety Features

- **Checkpoint-based**: Can resume from last successful batch if interrupted
- **Dual writes**: New DAO writes to both old and new tables during migration
- **Error handling**: Stops after 100 errors to prevent cascading failures
- **Batch processing**: Processes 200 items per batch for memory efficiency
- **Validation**: Verifies required fields before migration
- **Missing data handling**: Skips feed items for deleted blog posts

### Example Output

```
Starting feed migration...
================================================================================
Source table: FEED
Target table: cube-cobra-single-table

No checkpoint found. Starting from beginning.

Processing batch 1...
Scanned 200 items
Fetched 200 blog posts (0 missing)
Migrated 200 feed items
Total: 200 migrated, 0 skipped, 0 errors

Checkpoint saved.

Processing batch 2...
...

================================================================================
Migration complete!
Total feed items processed: 12543
Successfully migrated: 12543
Skipped (missing blog post): 0
Errors: 0
Checkpoint file deleted.
================================================================================
```

### Resuming After Interruption

If the script is interrupted, simply run it again. It will automatically resume from the last checkpoint:

```
Resuming from checkpoint at LastEvaluatedKey: {"id":"abc123","to":"user456"}
```

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

## Notification Migration

### Overview

The `migrateNotification.ts` script migrates notification data from the old NOTIFICATIONS table format to the new single-table design used by `NotificationDynamoDao`.

### Old Format (NOTIFICATIONS table)

- Partition key: `id` (String)
- GSI `ByTo`: `to` (PK), `date` (SK)
- GSI `ByToStatusComp`: `toStatusComp` (PK), `date` (SK)
- Direct storage of `Notification` objects with fields: id, date, to, from, fromUsername, url, body, status, toStatusComp

### New Format (Single Table Design)

- Partition key: `PK` = `NOTIFICATION#{id}`
- Sort key: `SK` = `NOTIFICATION`
- GSI1: `GSI1PK` = `NOTIFICATION#TO#{to}`, `GSI1SK` = `DATE#{date}` (for all user notifications)
- GSI2: `GSI2PK` = `NOTIFICATION#TO#{to}#STATUS#{status}`, `GSI2SK` = `DATE#{date}` (for filtered notifications by status)
- `DynamoVersion`: 1 (for optimistic locking)
- `item`: Contains all notification fields plus `dateCreated` and `dateLastUpdated`

### Running the Migration

```bash
cd packages/scripts
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateNotification.ts
```

### What the Script Does

1. **Scans** all notifications from the old NOTIFICATIONS table in batches of 200
2. **Validates** required fields (id, date, to)
3. **Checks** if each notification already exists in the new format (idempotent)
4. **Migrates** notifications that don't exist in the new format
5. **Adds timestamps**: Sets `dateCreated` and `dateLastUpdated` to notification date or current time if missing
6. **Ensures consistency**: Sets `toStatusComp` field correctly for GSI2 queries
7. **Checkpoints** progress after each batch to `migrateNotification-checkpoint.json`
8. **Reports** progress every 10 batches and provides a final summary

### Safety Features

- **Checkpoint-based**: Can resume from last successful batch if interrupted
- **Idempotent**: Can be run multiple times safely - skips already migrated notifications
- **Error handling**: Stops after 100 errors to prevent cascading failures
- **Batch processing**: Processes 200 items per batch for memory efficiency
- **Validation**: Verifies required fields before migration
- **Progress tracking**: Shows running count of migrated/skipped/errored items

### Example Output

```
Starting notification migration from old format to new DynamoDB format
================================================================================
Target table: cube-cobra-single-table
Scanning old table: prod_NOTIFICATIONS

No checkpoint found. Starting from beginning.

Progress: Batch 10 | 1,543 migrated, 12 skipped, 0 errors
Progress: Batch 20 | 3,821 migrated, 35 skipped, 0 errors
...

================================================================================
Migration complete!
Total notifications processed: 25,432
Successfully migrated: 25,387
Skipped (already exist or invalid): 45
Errors: 0

Note: Items without required fields (id, date, to) were skipped.
================================================================================
Checkpoint file deleted
```

### Resuming After Interruption

If the script is interrupted, simply run it again. It will automatically resume from the last checkpoint:

```
Resuming from checkpoint: batch 42, 8432 migrated
Previous stats: 8432 migrated, 18 skipped, 0 errors
```

## Troubleshooting

- **"Cannot find module"**: Make sure to build the server package first
- **"DYNAMO_TABLE must be defined"**: Set the environment variable in your `.env` file
- **Too many errors**: Check AWS credentials, table permissions, and DynamoDB configuration
- **Script hangs**: Check network connectivity to DynamoDB and ensure pagination is working

## Post-Migration

After successful migration:

1. Verify data integrity by spot-checking notifications in both tables
2. Test the application with the new `NotificationDynamoDao`
3. Monitor for any issues before removing the old NOTIFICATIONS table
4. Consider keeping dual-write mode enabled temporarily as a safety measure

## Checkpointing Feature

All migration scripts now support checkpointing, which allows them to resume from where they left off if interrupted. This is especially useful for large migrations that may take a long time or could be interrupted by network issues, timeouts, or other failures.

### How It Works

- After each batch of items is processed, the script saves a checkpoint to `.migration-checkpoints/` directory
- The checkpoint includes:
  - The last DynamoDB pagination key (`lastKey`)
  - Current statistics (migrated, skipped, errors, etc.)
  - Batch number
  - Timestamp
- If the script is interrupted, you can resume from the last checkpoint instead of starting over

### Command Line Options

Migration scripts that support checkpointing accept these options:

- **`--resume`**: Resume from the last checkpoint (if it exists)
- **`--reset`**: Clear any existing checkpoint and start fresh

### Scripts with Checkpointing

#### Blog Migration (`migrateBlog.ts`)

Migrates blog posts from old DynamoDB format to new single-table design.

**Usage:**

```bash
# Start fresh migration
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateBlog.ts

# Resume from last checkpoint
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateBlog.ts --resume

# Clear checkpoint and start over
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateBlog.ts --reset
```

#### Fix Blog Changelogs (`fixBlogChangelogs.ts`)

Fixes blog posts that are missing changelog references.

**Usage:**

```bash
# Fix all blogs
ts-node -r tsconfig-paths/register src/dynamoMigrations/fixBlogChangelogs.ts

# Fix a single blog (for testing)
ts-node -r tsconfig-paths/register src/dynamoMigrations/fixBlogChangelogs.ts --blog-id=<blog-id>

# Resume from last checkpoint
ts-node -r tsconfig-paths/register src/dynamoMigrations/fixBlogChangelogs.ts --resume

# Clear checkpoint and start over
ts-node -r tsconfig-paths/register src/dynamoMigrations/fixBlogChangelogs.ts --reset
```

### Checkpoint Files

Checkpoint files are stored in `.migration-checkpoints/` directory at the workspace root:

- `migrateBlog.json` - Checkpoint for blog migration
- `fixBlogChangelogs.json` - Checkpoint for blog changelog fixes

These files are automatically created, updated, and deleted by the scripts. You don't need to manage them manually, but you can inspect them to see the current state of a migration.

### Example Workflow

```bash
# Start a migration
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateBlog.ts

# If interrupted (Ctrl+C or error), resume with:
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateBlog.ts --resume

# If you want to start completely fresh:
ts-node -r tsconfig-paths/register src/dynamoMigrations/migrateBlog.ts --reset
```

### Notes on Checkpointing

- Checkpoints are saved after each successful batch, minimizing data loss on interruption
- The scripts automatically clear checkpoints on successful completion
- Checkpoints are migration-specific (each script has its own checkpoint file)
- If a migration script encounters too many errors, it will stop and preserve the checkpoint
- You can safely run `--resume` even if there's no checkpoint (it will start from the beginning)
- The `.migration-checkpoints/` directory can be safely deleted if you want to clear all checkpoints
