# LocalStack Setup

This guide provides detailed information about using LocalStack for local AWS service emulation.

## What is LocalStack?

[LocalStack](https://www.localstack.cloud/) provides a local emulation of AWS services required by CubeCobra, including:

- **S3**: File storage
- **DynamoDB**: NoSQL database
- **SES (Simple Email Service)**: Email delivery
- **CloudWatch**: Logging and monitoring

## Installation

### Docker (Recommended)

LocalStack runs best in Docker containers. This is automatically handled if you're using the [Docker setup](./docker-setup.md).

### Standalone Installation

#### macOS

```bash
brew install localstack/tap/localstack-cli
```

#### Linux

```bash
curl -Lo localstack-cli-3.0.2-linux-amd64-onefile.tar.gz \
    https://github.com/localstack/localstack-cli/releases/download/v3.0.2/localstack-cli-3.0.2-linux-amd64-onefile.tar.gz
sudo tar xvzf localstack-cli-3.0.2-linux-*-onefile.tar.gz -C /usr/local/bin
```

#### Windows

Download the binary from the [LocalStack releases page](https://github.com/localstack/localstack-cli/releases).

## Configuration

### Starting LocalStack

```bash
# Start in background
localstack start --detached

# Check status
localstack status

# Stop LocalStack
localstack stop
```

### Environment Configuration

LocalStack uses these environment variables:

```bash
# Point to LocalStack instead of real AWS
AWS_ENDPOINT=http://localhost:4566

# Use LocalStack for email capture
LOCALSTACK_SES=true

# LocalStack default credentials (any values work)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-2
```

## Services Used by CubeCobra

### S3 (Simple Storage Service)

LocalStack provides a local S3-compatible service for:

- Card data storage
- Export files
- Application assets

**Endpoint**: `http://localhost:4566`

#### Common S3 Operations

```bash
# List buckets
awslocal s3 ls

# List objects in bucket
awslocal s3 ls s3://local

# Copy file to bucket
awslocal s3 cp file.json s3://local/

# Download file from bucket
awslocal s3 cp s3://local/file.json ./
```

### DynamoDB

LocalStack provides local DynamoDB tables for:

- User accounts
- Cube definitions
- Card data
- Application metadata

#### Common DynamoDB Operations

```bash
# List tables
awslocal dynamodb list-tables

# Query a table
awslocal dynamodb execute-statement --statement 'SELECT * FROM LOCAL_USERS'

# Describe table
awslocal dynamodb describe-table --table-name LOCAL_USERS
```

### SES (Simple Email Service)

LocalStack captures emails instead of sending them, perfect for development.

#### Email Verification

```bash
# Verify an email address
awslocal ses verify-email-identity --email 'support@cubecobra.com'

# List verified emails
awslocal ses list-verified-email-addresses
```

#### Retrieving Captured Emails

```bash
# Get all emails sent to an address
curl --silent 'localhost.localstack.cloud:4566/_aws/ses?email=support@cubecobra.com' | jq .

# Get all captured emails
curl --silent 'localhost.localstack.cloud:4566/_aws/ses' | jq .
```

### CloudWatch

LocalStack provides basic CloudWatch functionality for logging.

## Data Persistence

### Community Edition Limitations

LocalStack Community Edition does **not** persist data between restarts. When you stop LocalStack, all data is lost.

### Pro Edition

LocalStack Pro provides data persistence. Configure with:

```bash
# Enable persistence (Pro only)
PERSISTENCE=1
```

### Manual Data Backup

For Community Edition, you can manually backup important data:

```bash
# Backup DynamoDB table
awslocal dynamodb scan --table-name LOCAL_USERS > users_backup.json

# Backup S3 bucket
awslocal s3 sync s3://local ./s3_backup/
```

## Troubleshooting

### LocalStack Not Starting

1. **Check Docker**: Ensure Docker is running
2. **Port Conflicts**: Check if port 4566 is already in use
3. **Memory**: Ensure sufficient memory allocated to Docker

```bash
# Check if LocalStack is running
curl http://localhost:4566/_localstack/health

# Check LocalStack logs
localstack logs
```

### Service Connection Issues

1. **Wrong Endpoint**: Ensure `AWS_ENDPOINT=http://localhost:4566`
2. **Credentials**: Any credentials work with LocalStack
3. **Region**: Use a valid AWS region name

### Email Issues

1. **Verify Email**: Run the verification command
2. **Check Capture**: Use the curl commands to see captured emails
3. **SES Setting**: Ensure `LOCALSTACK_SES=true`

## Development Workflow

### Typical LocalStack Workflow

1. **Start LocalStack**: `localstack start --detached`
2. **Run Setup**: This creates tables and uploads initial data
3. **Develop**: Your app connects to LocalStack services
4. **Debug**: Use `awslocal` commands to inspect data
5. **Reset**: Stop and restart LocalStack for clean state

### Useful Commands

```bash
# Quick health check
curl http://localhost:4566/_localstack/health

# Reset all data (restart LocalStack)
localstack stop && localstack start --detached

# Monitor logs in real-time
localstack logs -f
```

## Integration with CubeCobra

### Automatic Setup

When you run CubeCobra's setup scripts, they automatically:

1. Create necessary S3 buckets
2. Set up DynamoDB tables
3. Upload initial card data
4. Verify SES email addresses

### Manual Verification

You can verify the setup worked:

```bash
# Check S3 bucket exists
awslocal s3 ls s3://local

# Check DynamoDB tables exist
awslocal dynamodb list-tables

# Check card data uploaded
awslocal s3 ls s3://local/carddb/
```

## Switching to Real AWS

To switch from LocalStack to real AWS:

1. Comment out `AWS_ENDPOINT` in `.env`
2. Set `LOCALSTACK_SES=false`
3. Add real AWS credentials
4. Update bucket and resource names

See [AWS Configuration](./aws-configuration.md) for details.

## Next Steps

- [Environment Variables](./environment-variables.md) - Complete configuration
- [AWS Configuration](./aws-configuration.md) - Switch to real AWS
- [Troubleshooting](../setup-troubleshooting.md) - Common issues
