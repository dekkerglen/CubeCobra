# AWS Configuration

This guide covers connecting your local CubeCobra instance to real AWS resources instead of LocalStack.

## When to Use Real AWS

- You want to test against production-like services
- You need persistent data storage
- You're preparing for production deployment
- LocalStack limitations are blocking your development

## Required AWS Services

CubeCobra requires the following AWS services:

- **S3**: File storage for card data, exports, and assets
- **DynamoDB**: Database for users, cubes, cards, and application data
- **CloudWatch**: Logging and monitoring
- **SES (Simple Email Service)**: Email delivery

## Setting Up AWS Resources

### 1. Create S3 Bucket

1. Navigate to S3 in the AWS Console
2. Create a new bucket with a unique name
3. Configure appropriate permissions for your use case
4. Note the bucket name for your `.env` file

### 2. Set Up DynamoDB Tables

The application expects specific DynamoDB tables. You can either:

- **Option A**: Use the existing setup scripts with AWS credentials
- **Option B**: Manually create tables matching the LocalStack setup

#### Using Setup Scripts with AWS

1. Configure your AWS credentials in `.env`
2. Remove or comment out `AWS_ENDPOINT` 
3. Run the setup scripts - they'll create tables in real DynamoDB

### 3. Configure CloudWatch

1. Create a log group in CloudWatch
2. Optionally create a specific log stream
3. Note the log group name for your `.env` file

### 4. Set Up SES (Optional)

If you want to send real emails:

1. Set up SES in your AWS account
2. Verify your sending domain/email
3. Configure appropriate sending limits
4. Set `LOCALSTACK_SES=false` in your `.env`

## Environment Configuration

Update your `.env` file with real AWS credentials:

```bash
# Remove or comment out LocalStack endpoint
# AWS_ENDPOINT=http://localhost:4566

# Add your AWS credentials
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-2

# Update bucket and log group names
DATA_BUCKET=your-cubecobra-bucket
AWS_LOG_GROUP=your-log-group-name

# Disable LocalStack email if using real SES
LOCALSTACK_SES=false

# Other required variables remain the same
DYNAMO_PREFIX=LOCAL_
```

## Security Considerations

### IAM Permissions

Create an IAM user with minimal required permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:CreateTable",
                "dynamodb:DescribeTable"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/LOCAL_*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

### Environment Security

- Never commit `.env` files with real credentials
- Use AWS IAM roles in production environments
- Regularly rotate access keys
- Monitor CloudWatch for unusual activity

## Cost Considerations

Running against real AWS will incur costs:

- **S3**: Storage and request costs
- **DynamoDB**: Read/write capacity and storage
- **CloudWatch**: Log ingestion and storage
- **SES**: Email sending costs

Monitor your AWS billing dashboard and set up billing alerts.

## Switching Between LocalStack and AWS

You can easily switch between LocalStack and real AWS by modifying your `.env` file:

### For LocalStack
```bash
AWS_ENDPOINT=http://localhost:4566
LOCALSTACK_SES=true
```

### For Real AWS
```bash
# AWS_ENDPOINT=http://localhost:4566  # Comment out
LOCALSTACK_SES=false
```

## Troubleshooting

### Common Issues

1. **Access Denied**: Check IAM permissions and credentials
2. **Table Not Found**: Ensure DynamoDB tables exist with correct names
3. **Bucket Errors**: Verify bucket name and permissions
4. **Region Mismatch**: Ensure all services are in the same region

### Debugging

Enable debug logging by setting appropriate log levels in your application and monitoring CloudWatch logs for detailed error information.

## Next Steps

- [LocalStack Setup](./localstack-setup.md) - Switch back to LocalStack
- [Environment Variables](./environment-variables.md) - Complete configuration reference
