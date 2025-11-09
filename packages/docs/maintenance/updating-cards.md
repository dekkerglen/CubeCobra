# Updating Cards

CubeCobra keeps all card definitions in large pre-processed files for fast access. This guide covers how to update card data and keep it current.

## How Card Data Works

- **Memory Storage**: Cards are loaded into memory for fast access
- **File-Based**: Card data is stored in JSON files, not database queries
- **S3 Sync**: Production nodes download latest files from S3
- **External Updates**: A separate process updates definitions and uploads to S3

## Card Data Files

### Primary Files

- **`carddict.json`**: Main card database with all card information
- **`comboDict.json`**: Card combo and interaction data
- **`manifest.json`**: Metadata about card data versions and timestamps

### Location

- **Local Development**: `private/` directory
- **Production**: Downloaded from S3 bucket on startup

## Manual Card Updates

### Update Card Data

```bash
# Update just card definitions
npm run update-cards

# Update all card-related data
npm run update-all
```

### What `update-cards` Does

1. **Fetches Latest Data**: Downloads bulk card data from Scryfall
2. **Processes Data**: Transforms into CubeCobra format
3. **Generates Files**: Creates `carddict.json` and related files
4. **Uploads to S3**: Stores files for production use

### What `update-all` Does

Runs a complete update sequence:
1. `update-draft-history` - Draft analytics
2. `update-cube-history` - Cube analytics  
3. `update-metadata-dict` - Card metadata
4. `update-combos` - Card interactions
5. `update-cards` - Card definitions
6. `update-combos` - (again, after cards)
7. `update-cards` - (again, final pass)

## Docker Commands

### Using Docker Containers

```bash
# Update cards in Docker
docker exec -it cube npm run update-cards

# Full update in Docker
docker exec -it cube npm run update-all

# Check card files
docker exec -it cube ls -la private/
```

## Scheduled Updates

### Production Automation

In production, card updates run automatically:

- **Nightly**: Memory reload from S3 using node-schedule
- **Periodic**: External processes update S3 files
- **Bash Scripts**: Located in `jobs/definition/` for hourly, daily & weekly jobs

### Local Automation

For local development, you can set up similar automation:

```bash
# Add to crontab for daily updates at 2 AM
0 2 * * * cd /path/to/cubecobra && npm run update-cards
```

## Card Data Sources

### Scryfall API

Primary source for card data:
- **Bulk Data**: https://scryfall.com/docs/api/bulk-data
- **Card Objects**: Complete card information
- **Regular Updates**: Scryfall updates daily

### Data Processing

The update process:
1. **Downloads**: Bulk JSON from Scryfall
2. **Filters**: Removes irrelevant cards
3. **Transforms**: Converts to CubeCobra format
4. **Validates**: Ensures data integrity
5. **Compresses**: Optimizes for storage/transfer

## Troubleshooting Updates

### Common Issues

**Download Failures**
```bash
# Check network connectivity
curl -I https://api.scryfall.com/bulk-data

# Check disk space
df -h
```

**Memory Issues**
```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max_old_space_size=18192 npm run update-cards
```

**File Corruption**
```bash
# Validate JSON files
jq . private/carddict.json > /dev/null && echo "Valid JSON" || echo "Invalid JSON"

# Re-download if corrupted
rm private/carddict.json
npm run update-cards
```

### Docker-Specific Issues

**Container Memory**
- Ensure Docker has adequate memory allocated (16GB+)
- Check container resource limits

**Volume Mounting**
- Verify `private/` directory is properly mounted
- Check file permissions in container

## Verifying Updates

### Check File Timestamps

```bash
# Local files
ls -la private/*.json

# In Docker
docker exec -it cube ls -la private/*.json
```

### Validate Card Count

```bash
# Count cards in dictionary
jq 'length' private/carddict.json

# Check for specific cards
jq '.["Lightning Bolt"]' private/carddict.json
```

### Test Application

1. **Restart Application**: Reload card data
2. **Search Cards**: Verify new cards appear
3. **Check Logs**: Look for card loading messages

## Advanced Usage

### Custom Card Data

You can modify card data for testing:

```bash
# Backup original
cp private/carddict.json private/carddict.json.backup

# Edit for testing
jq '.["Custom Card"] = {"name": "Custom Card", "cmc": 1}' private/carddict.json > temp.json
mv temp.json private/carddict.json

# Restore original
cp private/carddict.json.backup private/carddict.json
```

### Development Workflow

For active development:

1. **Initial Setup**: Run full update once
2. **Development**: Use existing card data
3. **Testing**: Update specific cards as needed
4. **Pre-deployment**: Run full update

## Performance Considerations

### Memory Usage

Card updates are memory-intensive:
- **Node.js**: Increase heap size with `--max_old_space-size`
- **System**: Ensure adequate RAM available
- **Docker**: Allocate sufficient memory to containers

### Storage Space

Card files are large:
- **carddict.json**: ~100MB+ compressed
- **Total**: Several hundred MB for all files
- **Cleanup**: Remove old backups periodically

## Next Steps

- [Analytics](./analytics.md) - Card analytics and exports
- [Scheduled Jobs](./scheduled-jobs.md) - Automated maintenance
- [Troubleshooting](../setup-troubleshooting.md) - Common issues
