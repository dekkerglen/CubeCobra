# Card Database Manifest System

## Overview

The card database now uses a manifest-based update system that allows servers to intelligently determine when to update their local card data, rather than downloading all files on a fixed schedule.

## Manifest Structure

The manifest file (`cards/manifest.json`) contains:

```json
{
  "lastUpdated": "2026-01-17T12:00:00.000Z",
  "cardCount": 28450,
  "version": "1.0.0"
}
```

### Fields

- **lastUpdated** - ISO 8601 timestamp of when the card data was last updated
- **cardCount** - Total number of cards in the dataset
- **version** - Manifest format version (currently 1.0.0)

## Update Workflow (Jobs)

When `npm run update-cards` completes:

1. Counts the total number of cards in the dataset
2. Creates a manifest with the current timestamp and card count
3. Uploads the manifest to S3 alongside the card data files

Location: [`packages/jobs/src/update_cards.ts`](d:/Repos/CubeCobra/packages/jobs/src/update_cards.ts)

## Server Update Logic

The server checks the manifest **every 30 minutes** (instead of the previous 24-hour full update).

### Update Triggers

The server will download new card data if **any** of these conditions are met:

1. **No local manifest exists** - First-time setup or manifest was deleted
2. **Card count changed** - New cards were added or removed from the dataset
3. **Data is over 1 week old** - Ensures data freshness even without card count changes

### Update Process

1. Download the remote manifest from S3 (`cards/manifest.json`)
2. Load the local manifest from disk (`private/manifest.json`)
3. Compare manifests using the update triggers above
4. If update is needed:
   - Download all card data files from S3
   - Reload the card catalog into memory
   - Save the new manifest to disk
5. If no update is needed, skip download and use existing data

### Implementation Files

- **Server update logic**: [`packages/server/src/serverutils/updatecards.ts`](d:/Repos/CubeCobra/packages/server/src/serverutils/updatecards.ts)
- **Scheduled job**: [`packages/server/src/index.ts`](d:/Repos/CubeCobra/packages/server/src/index.ts)

## Benefits

### 1. Reduced Bandwidth

- Only downloads data when actually needed
- Prevents unnecessary downloads when data hasn't changed
- Especially helpful during periods of no card updates

### 2. Faster Updates

- Checks every 30 minutes instead of waiting 24 hours
- New cards appear in the system much faster
- Card count changes trigger immediate updates on next check

### 3. Data Freshness

- Maximum staleness of 1 week ensures data doesn't become too outdated
- Catches metadata updates, price changes, and other non-card-count changes

### 4. Resilience

- Local manifest persists across server restarts
- Gracefully handles missing or corrupted manifests
- Falls back to full update if manifest checks fail

## Example Scenarios

### Scenario 1: New Card Set Released

1. Job runs and adds 300 new cards
2. Card count changes from 28,450 to 28,750
3. Manifest updated with new count and timestamp
4. Within 30 minutes, server checks manifest
5. Sees card count changed, downloads all files
6. New cards immediately available

### Scenario 2: No Changes

1. Server checks manifest every 30 minutes
2. Card count unchanged: 28,450 → 28,450
3. Data age: 3 days (under 1 week)
4. No update needed, skips download
5. Saves bandwidth and processing time

### Scenario 3: Stale Data

1. No new cards for 8 days
2. Server checks manifest
3. Data age: 8 days (over 1 week)
4. Triggers update even though card count unchanged
5. Ensures metadata, prices, etc. are current

## Local Testing

To test the manifest system locally:

1. **Generate manifest** (in jobs package):

   ```bash
   npm run update-cards
   ```

2. **Check manifest** (in DATA_BUCKET S3):

   ```bash
   aws s3 cp s3://your-data-bucket/cards/manifest.json -
   ```

3. **Trigger server check**:

   - Wait 30 minutes for scheduled job, OR
   - Restart server to trigger immediate check on first 30-minute interval

4. **View logs**:
   - Look for "Checking for card database updates..." every 30 minutes
   - See decision output (update or skip)
   - Monitor download progress if update triggered

## Monitoring

### Key Log Messages

```
Checking for card database updates...
```

- Appears every 30 minutes when the check runs

```
Card count changed from 28450 to 28750, will update cards
```

- Indicates an update was triggered by card count change

```
Data is 8 days old (over 1 week), will update cards
```

- Indicates an update was triggered by staleness

```
Cards are up to date, no update needed
```

- No update required, using existing data

### Metrics to Monitor

- **Manifest check frequency**: Should be every 30 minutes
- **Update frequency**: Should match actual card data changes
- **Card count trends**: Track growth over time
- **Data age**: Maximum should be ~7 days plus check interval

## Backward Compatibility

- Old `updateCardbase()` function still exists for manual updates
- Can be called directly if needed for emergency updates
- Manifest system is additive, doesn't break existing functionality

## Future Enhancements

Potential improvements to the manifest system:

1. **File-level checksums** - Detect changes to individual files without downloading
2. **Incremental updates** - Download only changed files
3. **Version pinning** - Allow servers to lock to specific data versions
4. **Update notifications** - WebSocket or webhook notifications for instant updates
5. **Rollback support** - Ability to revert to previous manifest version
