# Analytics

CubeCobra generates analytics and data exports for cards, cubes, and drafts. This guide covers how these systems work and how to maintain them.

## Analytics Overview

### Types of Analytics

- **Card Analytics**: Pick rates, popularity, synergies
- **Draft History**: Historical draft data and patterns
- **Cube History**: Cube evolution and statistics
- **Metadata**: Processed card relationships and tags

### Data Flow

1. **Collection**: User interactions generate raw data
2. **Processing**: Scheduled jobs analyze and aggregate data
3. **Storage**: Results stored in JSON files and S3
4. **Serving**: Application loads processed data for display

## Card Analytics

### Data Sources

- **Draft Picks**: User selections during drafts
- **Cube Inclusions**: Cards included in active cubes
- **User Ratings**: Community ratings and feedback
- **Combo Data**: Card synergies and interactions

### Generated Metrics

- **Pick Rates**: How often cards are selected in drafts
- **Popularity**: Frequency of cube inclusion
- **Power Level**: Relative strength indicators
- **Synergy Scores**: Interaction strength with other cards

### Update Commands

```bash
# Update card analytics
npm run update-cards

# Update combo data specifically
npm run update-combos
```

## Draft History Analytics

### Purpose

Tracks drafting patterns to improve:

- Card recommendations
- Cube balance suggestions
- Draft bot behavior
- Meta analysis

### Data Processing

```bash
# Update draft history
npm run update-draft-history

# In Docker
docker exec -it cube npm run update-draft-history
```

### What Gets Analyzed

- **Pick Orders**: Sequence of card selections
- **Pack Positions**: Where cards are taken in packs
- **Color Preferences**: Drafting patterns by color
- **Archetype Data**: Successful draft strategies

## Cube History Analytics

### Tracking Changes

Monitors cube evolution over time:

- **Card Additions/Removals**: Cube composition changes
- **Power Level Shifts**: Meta evolution tracking
- **Popular Includes**: Trending additions
- **Format Analysis**: Different cube formats and their patterns

### Update Process

```bash
# Update cube history
npm run update-cube-history

# In Docker
docker exec -it cube npm run update-cube-history
```

## Metadata Dictionary

### Purpose

Processes card relationships and creates searchable metadata:

- **Mechanics**: Keyword abilities and rules text
- **Themes**: Tribal, combo, and synergy tags
- **Categories**: Functional groupings
- **Relationships**: Card interactions and dependencies

### Update Commands

```bash
# Update metadata dictionary
npm run update-metadata-dict

# In Docker
docker exec -it cube npm run update-metadata-dict
```

## Data Exports

### Export Types

CubeCobra generates several export files:

- **Cube Exports**: Complete cube data
- **Deck Exports**: Draft and sealed deck data
- **Card Dictionary**: Simplified card database

### Export Process

```bash
# Generate all exports
npm run exports

# Individual export commands
npm run export-cubes
npm run export-decks
npm run export-simple-card-dict

# Upload to S3
npm run upload-exports
```

### Export Workflow

1. **Generate Files**: Create export JSON files in `temp/export/`
2. **Compress**: Optimize file sizes
3. **Upload**: Sync to S3 bucket
4. **Cleanup**: Remove temporary files

## Scheduled Analytics

### Complete Update Sequence

```bash
# Run all analytics updates
npm run update-all
```

This runs in sequence:

1. Draft history analysis
2. Cube history analysis
3. Metadata dictionary processing
4. Combo analysis
5. Card data updates
6. Second combo pass (after card updates)
7. Final card updates

### Production Scheduling

Analytics run automatically in production:

- **Daily**: Core analytics updates
- **Weekly**: Comprehensive analysis
- **Monthly**: Full data exports

## Performance Considerations

### Memory Requirements

Analytics processing is memory-intensive:

```bash
# Use increased memory allocation
NODE_OPTIONS=--max_old_space_size=18192 npm run update-all
```

### Processing Time

Full analytics can take significant time:

- **Draft History**: 10-30 minutes
- **Card Analytics**: 20-60 minutes
- **Complete Update**: 1-3 hours

### Optimization Tips

1. **Incremental Updates**: Run specific updates instead of `update-all`
2. **Memory Monitoring**: Watch for memory leaks during long processes
3. **Scheduling**: Run during low-traffic periods
4. **Parallel Processing**: Some updates can run concurrently

## Monitoring Analytics

### Checking Progress

```bash
# Monitor running processes
ps aux | grep node

# Check log files for progress
tail -f logs/analytics.log

# In Docker, check container logs
docker logs cube -f
```

### Validating Results

```bash
# Check export file sizes
ls -lh temp/export/

# Validate JSON structure
jq . temp/export/cubes.json > /dev/null && echo "Valid"

# Check S3 upload status
awslocal s3 ls s3://local/exports/
```

## Troubleshooting Analytics

### Common Issues

**Memory Errors**

```bash
# Increase Node.js heap size
NODE_OPTIONS=--max_old_space_size=32768 npm run update-all
```

**Process Timeouts**

```bash
# Run individual components
npm run update-draft-history
npm run update-cube-history
# etc.
```

**Data Corruption**

```bash
# Backup before processing
cp -r temp/export temp/export.backup

# Validate inputs
jq . private/carddict.json > /dev/null
```

### Recovery Procedures

**Partial Failure**

- Identify which step failed from logs
- Run remaining steps individually
- Validate outputs before proceeding

**Complete Failure**

- Check system resources (memory, disk)
- Restore from backups if available
- Run full update-all after fixing issues

## Custom Analytics

### Adding New Metrics

1. **Identify Data Sources**: What raw data to analyze
2. **Create Processing Logic**: How to calculate metrics
3. **Update Pipeline**: Add to update sequence
4. **Test Thoroughly**: Validate with sample data

### Development Workflow

```bash
# Test with limited data
NODE_ENV=development npm run update-cards

# Validate intermediate results
jq '.analytics' private/carddict.json | head -20

# Full production test
npm run update-all
```

## Next Steps

- [Updating Cards](./updating-cards.md) - Card data maintenance
- [Scheduled Jobs](./scheduled-jobs.md) - Automation setup
- [Setup Troubleshooting](../setup-troubleshooting.md) - Common issues
