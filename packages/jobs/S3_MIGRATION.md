# S3-Based Caching for Update Jobs

## Overview

The `npm run update-all` workflow has been refactored to use Amazon S3 for cumulative cache storage instead of relying on local filesystem storage. This enables the workflow to run on any machine or environment without requiring local cache files to be preserved between runs.

## Environment Variables

### Required

- `JOBS_BUCKET` - The S3 bucket name where job data and cache files will be stored

### Optional (inherited from server configuration)

- `AWS_REGION` - AWS region for S3 operations
- `AWS_ENDPOINT` - Custom AWS endpoint (for local development with LocalStack)
- AWS credentials should be configured through standard AWS credential providers

## S3 Bucket Structure

The JOBS_BUCKET will contain the following structure:

```
JOBS_BUCKET/
├── cache/
│   ├── cards.json                    # Scryfall card data cache
│   ├── all-cards.json                # Scryfall all cards cache
│   ├── sets.json                     # Scryfall sets cache
│   ├── cardkingdom-prices.json       # Card Kingdom prices cache
│   ├── manapool-prices.json          # Mana Pool prices cache
│   └── comboDict.json                # Commander Spellbook combos cache
├── global_draft_history/
│   ├── 2019-6-15.json
│   ├── 2019-6-16.json
│   └── ...                           # Daily draft history aggregates
├── cube_draft_history/
│   ├── {cubeId1}.json
│   ├── {cubeId2}.json
│   └── ...                           # Per-cube draft analytics
├── drafts_by_day/
│   ├── 2019-6-15.json
│   ├── 2019-6-16.json
│   └── ...                           # Daily draft metadata
├── all_drafts/
│   ├── 2019-6-15_0.json
│   ├── 2019-6-15_1.json
│   └── ...                           # Batched draft details
├── cubes_history/
│   ├── 2020-1-1.json
│   ├── 2020-1-2.json
│   └── ...                           # Daily cube composition snapshots
├── combos/
│   ├── comboDict.json                # Combo dictionary
│   └── comboTree.json                # Combo tree for fast lookup
├── metadatadict.json                 # Card metadata dictionary
└── indexToOracle.json                # Oracle ID index mapping
```

## Migration Steps

1. **Install Dependencies**

   ```bash
   cd packages/jobs
   npm install
   ```

2. **Set Environment Variable**
   Add to your `.env` file in `packages/jobs/`:

   ```
   JOBS_BUCKET=your-jobs-bucket-name
   ```

3. **Upload Existing Local Cache (if migrating)**
   If you have existing local cache files in `./temp/`, you can upload them to S3:

   ```bash
   # Example using AWS CLI
   aws s3 sync ./temp/ s3://your-jobs-bucket-name/ --exclude "*" --include "*.json"
   ```

4. **Run Update Jobs**
   ```bash
   npm run update-all
   ```

## How It Works

### Incremental Processing

All update scripts now:

1. **Check S3** for existing processed files to determine which days/data have already been processed
2. **Load most recent state** from S3 to continue from the last run
3. **Process new data** incrementally
4. **Upload results** back to S3 for the next run

### Caching Strategy

- **Scryfall data** (cards, sets) is cached in S3 to avoid repeated downloads
- **Price data** (Card Kingdom, Mana Pool) is cached in S3
- **Combo data** from Commander Spellbook is cached in S3
- All caches are automatically used if the JOBS_BUCKET environment variable is set

### Key Benefits

1. **No local storage requirements** - can run on ephemeral compute instances
2. **Shared state** - multiple instances can access the same cache
3. **Incremental updates** - only processes new data since the last run
4. **Resilience** - failures don't require starting from scratch

## Backward Compatibility

The scripts maintain backward compatibility:

- If `JOBS_BUCKET` is not set, some caching features will be disabled
- The scripts will still function but may need to download more data
- For production use, `JOBS_BUCKET` should always be set

## Modified Files

- `packages/jobs/src/utils/s3.ts` - New S3 utility module
- `packages/jobs/src/update_draft_history.ts` - Refactored to use S3
- `packages/jobs/src/update_cube_history.ts` - Refactored to use S3
- `packages/jobs/src/update_metadata_dict.ts` - Refactored to use S3
- `packages/jobs/src/update_cards.ts` - Refactored caching to use S3
- `packages/jobs/src/update_combos.ts` - Refactored caching to use S3
- `packages/jobs/package.json` - Added AWS SDK dependencies

## Troubleshooting

### Permission Issues

Ensure your AWS credentials have the following S3 permissions:

- `s3:PutObject`
- `s3:GetObject`
- `s3:ListBucket`
- `s3:DeleteObject` (optional, for cleanup)

### Missing JOBS_BUCKET

If you see errors about missing JOBS_BUCKET:

```
Error: JOBS_BUCKET environment variable is not set
```

Set the environment variable before running the jobs.

### S3 Connection Issues

Check that:

- AWS credentials are properly configured
- The bucket exists and is accessible
- Network connectivity to S3 is available
- AWS_REGION is set correctly
