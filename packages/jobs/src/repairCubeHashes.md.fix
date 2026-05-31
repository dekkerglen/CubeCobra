# Repair Cube Hashes Job

## Overview

The `repairCubeHashes` job is a maintenance script that ensures all cube hash rows in DynamoDB are accurate and complete. Hash rows are used for efficient querying and filtering of cubes by various criteria.

## What It Does

This job:

1. **Queries all cubes** using the `cube:all` hash with pagination
2. **Fetches current hash rows** for each cube from DynamoDB
3. **Calculates expected hashes** based on:
   - Cube metadata (shortId, featured status, category, tags, keywords)
   - **Card oracle IDs** from the cube's mainboard cards (stored in S3)
4. **Compares current vs expected** to identify:
   - Missing hashes that need to be added
   - Stale hashes that need to be removed
5. **Writes the delta** to DynamoDB in batches

## Hash Types

The job repairs all types of hashes:

### Metadata Hashes

- `cube:all` - Global cube hash
- `shortid:{shortId}` - Cube short ID lookup
- `featured:true` - Featured cubes (if applicable)
- `category:{category}` - Cube category and category prefixes
- `tag:{tag}` - Cube tags (normalized to lowercase)
- `keywords:{keywords}` - All keyword combinations from cube name

### Card Hashes

- `oracle:{oracleId}` - One hash per unique card in the cube
  - Enables querying "cubes containing card X"
  - Automatically calculated from cube's mainboard cards

## Usage

Run the job from the `packages/jobs` directory:

```bash
npm run repair-cube-hashes
```

Or with explicit node options:

```bash
NODE_OPTIONS=--max_old_space-size=18192 ts-node -r tsconfig-paths/register --project tsconfig.json src/repairCubeHashes.ts
```

## Performance

- Processes cubes in **batches of 100**
- Uses **parallel operations** within each batch for maximum throughput
- Typical processing time: ~1-2 seconds per batch
- For 10,000 cubes: ~3-5 minutes total

## Output

The job provides real-time progress:

```
Processing batch 1 (100 cubes)...
Repaired cube abc123 (My Cube): +5 -2 =45
Batch 1 complete in 1.23s. Progress: 100 cubes, 12 with changes, 0 errors

=== Cube Hash Repair Complete ===
Cubes processed: 10000
Cubes with changes: 1234
Total hashes added: 5678
Total hashes removed: 234
Total hashes unchanged: 123456
Owners fixed: 0
Errors: 0
```

## When to Run

Run this job when:

1. **Hash logic changes** - After modifying hash calculation in `CubeDynamoDao`
2. **Data inconsistencies** - If queries return unexpected results
3. **After migrations** - When migrating cubes from old data model
4. **Card updates** - After bulk card data changes (rare)
5. **Regular maintenance** - Quarterly as a health check

## Error Handling

- Individual cube failures are logged but don't stop the job
- Statistics track error count
- Exit code 1 on fatal errors, 0 on success (even with individual failures)

## Implementation Details

The job leverages `CubeDynamoDao.repairHashes()` which:

1. Fetches the cube from DynamoDB
2. Loads cards from S3 (`cube/{id}.json`)
3. Extracts unique oracle IDs from mainboard cards using `cardFromId()`
4. Generates metadata hashes using `getHashStrings()`
5. Creates oracle hashes for each unique card
6. Queries existing hash rows using `getHashesForCube()`
7. Calculates diff and writes batch operations

## Hash Row Structure

Each hash row stores:

```typescript
{
  PK: 'HASH#CUBE#{cubeId}',      // Partition key
  SK: '{hashString}',             // Sort key (the hash itself)
  GSI1PK: '{hashString}',         // For popularity sorting
  GSI1SK: 'FOLLOWERS#{count}',
  GSI2PK: '{hashString}',         // For alphabetical sorting
  GSI2SK: 'NAME#{cubeName}',
  GSI3PK: '{hashString}',         // For card count sorting
  GSI3SK: 'CARDS#{count}',
  GSI4PK: '{hashString}',         // For date sorting
  GSI4SK: 'DATE#{timestamp}',
  cubeName: string,               // Denormalized for quick access
  cubeFollowers: number,
  cubeCardCount: number
}
```

## Safety

- **Read-heavy operation** - Only writes when differences detected
- **Idempotent** - Can be run multiple times safely
- **Atomic operations** - Uses DynamoDB batch writes (max 25 per batch)
- **No cube data modification** - Only repairs index data

## Dependencies

- Card database (`carddb`) must be initialized
- Requires access to:
  - DynamoDB table (via `DYNAMO_TABLE` env var)
  - S3 bucket (via `DATA_BUCKET` env var)
  - Private card data directory

## Related Files

- `packages/server/src/dynamo/dao/CubeDynamoDao.ts` - Main DAO with `repairHashes()` method
- `packages/server/src/dynamo/dao/BaseDynamoDao.ts` - Base hash functionality
- `packages/server/src/serverutils/carddb.ts` - Card data access
