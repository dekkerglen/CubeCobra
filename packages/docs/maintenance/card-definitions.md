# Card Definitions Management

CubeCobra maintains a comprehensive database of Magic: The Gathering cards through a sophisticated card definitions management system. This guide covers how card definitions are structured, updated, and managed.

## Overview

Card definitions in CubeCobra serve as the foundation for all cube management features. The system is designed for performance and reliability, using pre-processed JSON files that are loaded into memory rather than making database queries for each card lookup.

### Key Concepts

- **Card Definitions**: Static card data (name, mana cost, rules text, etc.)
- **Card Analytics**: Dynamic data (popularity, pick rates, synergies)
- **Card Dictionary**: The main lookup table for all card information
- **Combo Dictionary**: Relationships and interactions between cards

## System Architecture

### Data Flow

1. **Source**: Scryfall API provides authoritative card data
2. **Processing**: CubeCobra scripts transform and enhance the data
3. **Storage**: Processed files stored in S3 and local `private/` directory
4. **Loading**: Application loads files into memory on startup
5. **Updates**: Periodic updates refresh data from source

### File Structure

```
packages/server/
├── private/                   # Card definitions and metadata
│   ├── carddict.json         # Main card database
│   ├── comboDict.json        # Card combination data
│   ├── manifest.json         # Version and metadata information
│   ├── nameToId.json         # Card name to ID mapping
│   ├── cardimages.json       # Image URL mappings
│   └── ...                   # Additional specialized files
└── model/                    # ML model files for AI features
    ├── encoder/              # Card encoding models
    ├── draft_decoder/        # Draft bot AI models
    ├── cube_decoder/         # Cube analysis models
    └── ...                   # Additional model files
```

## Core Scripts

### `download-data-files.js`

The primary script for downloading essential data files during initial setup.

**Location**: `packages/scripts/download-data-files.js`

**Purpose**:

- Downloads latest card data from the public S3 bucket (`cubecobra-public`)
- Downloads ML model files for draft bots
- Places files in correct monorepo locations
- **First-time setup only** - not for regular updates

**Safety & Requirements**:

- ✅ **Safe to run** - Downloads from a public S3 bucket
- ✅ **No AWS credentials required** - Public bucket access only
- ✅ **No LocalStack configuration needed** - Connects directly to AWS

**Usage**:

```bash
# Via npm script (recommended)
npm run download-data-files

# Direct execution
node --max-old-space-size=8192 packages/scripts/download-data-files.js
```

**What it does**:

1. Downloads card definitions to `/packages/server/private/` from `s3://cubecobra-public/cards/`
2. Downloads ML model files to `/packages/server/model/` from `s3://cubecobra-public/model/`
3. Ensures directory structure exists
4. Provides clear feedback on download progress

### `force_update.js` (Legacy)

**⚠️ Note**: This script is being phased out in favor of the new `download-data-files.js` for monorepo setups.

**Location**: `packages/scripts/force_update.js`

**Purpose**:

- Legacy script for updating card definitions
- Still used in some existing workflows
- Calls `updateCardbase()` and `downloadFromS3()`

### `updateCardbase()` Function

**Location**: `packages/server/src/util/updatecards.js`

**Purpose**: Core function that manages card definition downloads

**Process**:

1. **Download from S3**: Retrieves latest processed card files
2. **Local Storage**: Saves files to specified directory (default: `packages/server/private/`)
3. **Memory Loading**: Loads files into application memory via `loadAllFiles()`

### Update Scripts in `src/jobs/`

More specialized update scripts for different aspects of card data:

- **`update_cards.ts`**: Comprehensive card data update from Scryfall
- **`update_combos.ts`**: Updates card interaction and combo data
- **`update_metadata_dict.ts`**: Processes card metadata and relationships

## Card Definition Format

### Card Dictionary Structure

Each card in `carddict.json` contains:

```javascript
{
  "cardId": {
    "name": "Lightning Bolt",
    "mana_cost": "{R}",
    "cmc": 1,
    "type_line": "Instant",
    "oracle_text": "Lightning Bolt deals 3 damage to any target.",
    "colors": ["R"],
    "color_identity": ["R"],
    "legalities": {
      "standard": "not_legal",
      "modern": "legal",
      // ... other formats
    },
    "set": "alpha",
    "rarity": "common",
    "artist": "Christopher Rush",
    "image_uris": {
      "small": "https://...",
      "normal": "https://...",
      "large": "https://..."
    },
    // ... additional fields
  }
}
```

### Combo Dictionary Structure

Card combinations in `comboDict.json`:

```javascript
{
  "cardId": {
    "synergies": ["relatedCardId1", "relatedCardId2"],
    "combos": [
      {
        "cards": ["cardId", "comboPartner"],
        "description": "Combo description",
        "tags": ["infinite", "damage"]
      }
    ]
  }
}
```

## Update Workflows

### Initial Setup (First Time Only)

During initial setup, you need to download the essential data files:

```bash
# First-time installation only
npm run download-data-files
```

This downloads:

- Card definitions to `/packages/server/private/`
- ML model files to `/packages/server/model/`

**Important**: This is only required once during initial setup, not for regular updates.

### Development Updates

For development work and regular updates:

```bash
# Quick card definition update (legacy)
npm run cards

# Full update including analytics
npm run update-all
```

### Production Updates

Production systems use automated updates:

- **Scheduled jobs**: Nightly updates via `src/jobs/` scripts
- **Manual triggers**: For urgent card data updates
- **Release cycles**: Comprehensive updates with new sets

## Memory Management

### Loading Strategy

Card definitions are loaded into memory for performance:

```javascript
// In server startup
await updateCardbase(); // Download and load files
await loadAllFiles(); // Load into memory structures
```

### Memory Usage

- **`carddict.json`**: ~100MB+ when loaded
- **Total memory**: Several hundred MB for all card data
- **Optimization**: Lazy loading for less-used data structures

### Performance Considerations

- **Startup time**: Card loading adds ~30-60 seconds to startup
- **Memory footprint**: Significant RAM usage for card data
- **Update time**: Full updates can take 10-30 minutes

## Data Sources

### Scryfall API

Primary source for card data:

- **Bulk Data**: Daily snapshots of all cards
- **Individual Cards**: Real-time updates for specific cards
- **Images**: Card artwork and scans
- **Metadata**: Set information, legalities, etc.

### Data Processing

CubeCobra enhances Scryfall data with:

- **Cube-specific metadata**: Popularity, archetypes, tags
- **Combo relationships**: Card synergies and interactions
- **Performance optimizations**: Indexed lookups, compressed formats
- **Custom fields**: CubeCobra-specific attributes

## Maintenance Tasks

### Regular Updates

**Daily**:

- Download latest card definitions
- Update card images and metadata
- Refresh combo relationships

**Weekly**:

- Full analytics recalculation
- Data validation and cleanup
- Performance optimization

**Monthly**:

- Comprehensive data export
- Archive old versions
- Capacity planning

### Manual Intervention

**New Set Releases**:

1. Wait for Scryfall to update their bulk data
2. Run `npm run update-cards` to fetch new cards
3. Update combo relationships for new cards
4. Test search and filtering functionality
5. Deploy updates to production

**Emergency Updates**:

- Errata or rules changes
- Banned/unbanned cards
- Critical bug fixes

## Troubleshooting

### Common Issues

**Missing Cards**:

```bash
# Check if card exists in source data
grep "card_name" private/carddict.json

# Force refresh from Scryfall
npm run update-cards
```

**Memory Issues**:

```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max_old_space_size=18192 npm run cards
```

**Outdated Data**:

```bash
# Check last update time
cat private/manifest.json | jq .last_updated

# Force complete refresh
rm -rf private/
npm run cards
```

### File Corruption

**Validation**:

```bash
# Check JSON validity
jq . private/carddict.json > /dev/null && echo "Valid" || echo "Invalid"

# Check file sizes
ls -lh private/*.json
```

**Recovery**:

```bash
# Re-download from S3
rm private/carddict.json
npm run cards

# Full rebuild from Scryfall
npm run update-cards
```

## Development Guidelines

### Modifying Card Data

1. **Never edit card files directly** - Always use update scripts
2. **Test locally first** - Verify changes don't break functionality
3. **Document changes** - Update this documentation for new fields
4. **Consider performance** - Large changes may affect memory usage

### Adding New Fields

1. **Update processing scripts** in `src/jobs/update_cards.ts`
2. **Modify data structures** if needed
3. **Update TypeScript types** for new fields
4. **Test search and filtering** with new fields
5. **Document usage** in relevant guides

### Custom Card Data

For development/testing with custom cards:

```bash
# Backup original
cp private/carddict.json private/carddict.json.backup

# Edit carefully (use jq for safety)
jq '.["custom_id"] = {"name": "Test Card", ...}' private/carddict.json > temp.json
mv temp.json private/carddict.json

# Restore when done
cp private/carddict.json.backup private/carddict.json
```

## API Integration

### Scryfall API Usage

CubeCobra respects Scryfall's API guidelines:

- **Rate limiting**: Respects API rate limits
- **Bulk downloads**: Uses bulk data endpoints when possible
- **Caching**: Caches data locally to minimize requests
- **Attribution**: Properly credits Scryfall as data source

### Internal APIs

Card data is exposed through internal APIs:

- **Search endpoints**: Card filtering and lookup
- **Autocomplete**: Fast card name matching
- **Image serving**: Cached image delivery
- **Analytics**: Card statistics and trends

## Security Considerations

### Data Integrity

- **Checksums**: Verify file integrity after downloads
- **Validation**: Ensure card data meets expected schema
- **Backup**: Maintain backups of working card sets

### Access Control

- **S3 permissions**: Limit access to card data buckets
- **API keys**: Secure any external API credentials
- **Update permissions**: Restrict who can trigger updates

## Future Enhancements

### Planned Improvements

- **Incremental updates**: Only update changed cards
- **Compression**: Reduce memory footprint
- **CDN integration**: Faster card image delivery
- **Real-time updates**: Live updates for new cards

### Extension Points

- **Custom data sources**: Support additional card databases
- **Plugin system**: Allow custom card processing
- **Caching layers**: Redis or similar for frequently accessed data

## Related Documentation

- [Updating Cards](./updating-cards.md) - Operational guide for card updates
- [Analytics](./analytics.md) - Card analytics and data processing
- [Scheduled Jobs](./scheduled-jobs.md) - Automated maintenance tasks
- [Parser Documentation](../parser.md) - Card filtering and search system

## Support

For issues with card definitions:

- **Discord**: Ask in development channels
- **Check logs**: Look for update errors in application logs
- **Verify data**: Compare with Scryfall source data
- **Contact maintainers**: @Dekkaru on Discord for urgent issues
