# Scheduled Jobs

CubeCobra uses various scheduled jobs to maintain data freshness and perform routine maintenance. This guide covers the automated job system and how to manage it.

## Job Categories

### Production Jobs

**Location**: `jobs/definition/`

- **Hourly Jobs**: High-frequency maintenance
- **Daily Jobs**: Regular data updates
- **Weekly Jobs**: Comprehensive analysis
- **Monthly Jobs**: Full data exports and cleanup

### Node-based Jobs

**Location**: Express server with node-schedule

- **Nightly Reload**: Card database refresh from S3
- **Memory Management**: Garbage collection and optimization
- **Health Checks**: System status monitoring

## Production Job System

### Job Definitions

Bash scripts in `jobs/definition/` are executed by AWS systems:

```bash
# View available job definitions
ls jobs/definition/

# Example job structure
cat jobs/definition/daily_card_update.sh
```

### Scheduling

Jobs are scheduled using AWS CloudWatch Events or similar:

- **Cron Expressions**: Standard cron syntax
- **Event Triggers**: S3 uploads, DynamoDB changes
- **Manual Triggers**: On-demand execution

### Common Production Jobs

**Daily Jobs**
- Card data updates
- Analytics processing
- User activity cleanup
- Cache warming

**Weekly Jobs**
- Full analytics recalculation
- Database optimization
- Backup verification
- Performance analysis

**Monthly Jobs**
- Complete data exports
- Archive old data
- Security audits
- Capacity planning

## Local Scheduled Jobs

### Node-Schedule Integration

The Express server runs scheduled tasks:

```javascript
// Example from server code
const schedule = require('node-schedule');

// Nightly card database reload
schedule.scheduleJob('0 2 * * *', async () => {
  await reloadCardDatabase();
});
```

### Memory Reload Jobs

**Purpose**: Keep card data fresh without server restart

**Schedule**: Typically runs at 2 AM daily

**Process**:
1. Download latest files from S3
2. Validate file integrity
3. Replace in-memory card database
4. Log completion status

### Local Development Jobs

For development, you can run jobs manually:

```bash
# Simulate nightly reload
npm run update-cards

# Full maintenance cycle
npm run update-all

# Specific maintenance tasks
npm run rotate-queue
npm run rotate-daily-p1p1
npm run sync-podcasts
```

## Job Management

### Manual Job Execution

```bash
# Run specific jobs
npm run update-cards
npm run update-draft-history
npm run exports

# In Docker
docker exec -it cube npm run update-cards
docker exec -it cube npm run exports
```

### Job Monitoring

```bash
# Check job logs
tail -f logs/scheduled-jobs.log

# Monitor running processes
ps aux | grep 'node.*update'

# In Docker
docker logs cube -f | grep -i schedule
```

### Job Status Checking

```bash
# Check last successful run
ls -la private/*.json

# Verify S3 uploads (LocalStack)
awslocal s3 ls s3://local/carddb/

# Check job completion markers
ls -la temp/job-status/
```

## Queue Management Jobs

### Featured Queue Rotation

**Purpose**: Manage featured cube rotation

**Schedule**: Daily

**Command**: 
```bash
npm run rotate-queue
```

**Function**:
- Selects new featured cubes
- Updates queue status
- Manages featured duration

### Daily P1P1 Rotation

**Purpose**: Rotate Pick 1 Pack 1 options

**Schedule**: Daily

**Command**:
```bash
npm run rotate-daily-p1p1
```

**Function**:
- Updates daily draft options
- Manages pack rotation
- Tracks completion statistics

## Content Sync Jobs

### Podcast Synchronization

**Purpose**: Update podcast feed and metadata

**Schedule**: Weekly

**Command**:
```bash
npm run sync-podcasts
```

**Function**:
- Fetches latest podcast episodes
- Updates metadata
- Manages archive cleanup

## Export Jobs

### Data Export Generation

**Purpose**: Create data exports for external use

**Schedule**: Weekly/Monthly

**Commands**:
```bash
# Generate all exports
npm run exports

# Individual exports
npm run export-cubes
npm run export-decks
npm run export-simple-card-dict
```

**Output**:
- Cube data exports
- Deck collection exports
- Simplified card dictionaries

### S3 Upload

**Purpose**: Upload exports to S3 for public access

**Command**:
```bash
npm run upload-exports
```

**Function**:
- Syncs `temp/export/` to S3
- Manages public access permissions
- Updates CDN cache

## Development Scheduling

### Local Cron Setup

For persistent local development:

```bash
# Edit crontab
crontab -e

# Add daily card update at 2 AM
0 2 * * * cd /path/to/cubecobra && npm run update-cards

# Add weekly full update on Sunday at 3 AM
0 3 * * 0 cd /path/to/cubecobra && npm run update-all
```

### Docker Cron

For Docker-based development:

```dockerfile
# Add to Dockerfile
RUN apt-get update && apt-get install -y cron

# Create cron job file
COPY crontab /etc/cron.d/cubecobra-jobs
RUN chmod 0644 /etc/cron.d/cubecobra-jobs
RUN crontab /etc/cron.d/cubecobra-jobs
```

### Development Environment

```bash
# Create local job runner script
#!/bin/bash
cd /path/to/cubecobra
npm run update-cards
npm run rotate-queue
npm run rotate-daily-p1p1
```

## Job Configuration

### Environment Variables

Jobs respect environment configuration:

```bash
# Control job execution
ENABLE_SCHEDULED_JOBS=true
JOB_CONCURRENCY_LIMIT=2
JOB_TIMEOUT_MINUTES=60

# Memory limits for jobs
NODE_OPTIONS=--max_old_space_size=18192
```

### Resource Management

**Memory Allocation**:
- Card updates: 18GB+ heap
- Analytics: 16GB+ heap
- Exports: 8GB+ heap

**CPU Considerations**:
- Avoid running multiple intensive jobs simultaneously
- Schedule during low-traffic periods
- Monitor system load

## Troubleshooting Jobs

### Common Issues

**Memory Exhaustion**
```bash
# Increase Node.js memory
NODE_OPTIONS=--max_old_space_size=32768 npm run update-all

# Check system memory
free -h
```

**Job Timeouts**
```bash
# Run jobs individually
npm run update-draft-history
npm run update-cube-history
# Continue with remaining jobs
```

**S3 Upload Failures**
```bash
# Check AWS credentials
awslocal s3 ls

# Verify bucket permissions
awslocal s3api get-bucket-acl --bucket local
```

### Debugging Jobs

```bash
# Enable debug logging
DEBUG=* npm run update-cards

# Monitor job progress
tail -f logs/job-*.log

# Check job exit codes
echo $?  # After running job
```

### Recovery Procedures

**Failed Job Recovery**:
1. Identify failure point from logs
2. Clean up partial results
3. Restart from safe checkpoint
4. Monitor subsequent runs

**Data Corruption**:
1. Stop all jobs immediately
2. Restore from latest backup
3. Investigate root cause
4. Implement preventive measures

## Job Optimization

### Performance Tuning

**Parallel Processing**:
- Run independent jobs concurrently
- Use worker threads for CPU-intensive tasks
- Implement queue-based processing

**Resource Optimization**:
- Stream large data instead of loading into memory
- Use incremental updates where possible
- Implement smart caching strategies

### Monitoring and Alerting

**Key Metrics**:
- Job completion time
- Memory usage patterns
- Error rates
- Data freshness

**Alerting Setup**:
- Job failure notifications
- Resource usage alerts
- Data staleness warnings
- Performance degradation alerts

## Next Steps

- [Updating Cards](./updating-cards.md) - Card maintenance details
- [Analytics](./analytics.md) - Analytics system overview
- [Setup Troubleshooting](../setup-troubleshooting.md) - Common issues
