# Environment Variables

Environment variables are populated from the `.env` file. There is no `.env` file checked in, so the setup script copies `.env_EXAMPLE` to `.env` with default values to support CubeCobra backed by LocalStack. The `.env_EXAMPLE` file is also loaded in the context of Jest tests.

## Configuration Reference

| Variable Name         | Description                                                                                  | Required? | Default   |
| --------------------- | -------------------------------------------------------------------------------------------- | --------- | --------- |
| AWS_ACCESS_KEY_ID     | The AWS access key for your account                                                          | Yes       | -         |
| AWS_ENDPOINT          | The base endpoint to use for AWS. Used to point to LocalStack rather than hosted AWS         | No        | -         |
| AWS_LOG_GROUP         | The name of the AWS CloudWatch log group to use                                              | Yes       | -         |
| AWS_LOG_STREAM        | The name of the AWS CloudWatch log stream to use                                             | No        | -         |
| AWS_REGION            | The AWS region to use                                                                        | Yes       | us-east-2 |
| AWS_SECRET_ACCESS_KEY | The AWS secret access key for your account                                                   | Yes       | -         |
| CAPTCHA_SITE_KEY      | The reCAPTCHA site key                                                                       | Yes       | -         |
| CAPTCHA_SECRET_KEY    | The reCAPTCHA secret key                                                                     | Yes       | -         |
| CUBECOBRA_VERSION     | The version of Cube Cobra                                                                    | No        | -         |
| DATA_BUCKET           | The name of the AWS S3 bucket to use. You will need to create this bucket in your account    | Yes       | -         |
| DOMAIN                | The domain name of the server. Used for external redirects such as emails                    | Yes       | -         |
| DOWNTIME_ACTIVE       | Whether or not the site is in downtime mode                                                  | No        | false     |
| DRAFTMANCER_API_KEY   | The Draftmancer API key                                                                      | Yes       | -         |
| DYNAMO_PREFIX         | The prefix to use for DynamoDB tables. You can leave this as the default value               | Yes       | -         |
| ENV                   | The environment to run Cube Cobra in                                                         | Yes       | -         |
| HTTP_ONLY             | If set to exactly "true", generate http:// instead of https:// links                         | No        | false     |
| LOCALSTACK_SES        | Set to "true" to send emails via SES outside production. Assumes LocalStack running to catch | No        | true      |
| NITROPAY_ENABLED      | Whether or not to enable NitroPay, our ad provider                                           | No        | false     |
| NODE_ENV              | The environment to run Cube Cobra in                                                         | Yes       | -         |
| PATREON_CLIENT_ID     | The client ID for the Patreon OAuth app                                                      | No        | -         |
| PATREON_CLIENT_SECRET | The client secret for the Patreon OAuth app                                                  | No        | -         |
| PATREON_HOOK_SECRET   | The secret for the Patreon webhook                                                           | No        | -         |
| PATREON_REDIRECT      | The redirect URL for the Patreon OAuth app                                                   | No        | -         |
| PORT                  | The port to run Cube Cobra on                                                                | Yes       | 5000      |
| SESSION_SECRET        | A secret phrase for session encryption. You can leave the default value                      | Yes       | -         |
| SESSION               | The name of the session cookie. You can leave the default value                              | Yes       | -         |
| STRIPE_SECRET_KEY     | Stripe secret key. Must have a value                                                         | Yes       | -         |

## Local Development Setup

For local development, the setup scripts will create a `.env` file based on `.env_EXAMPLE` with appropriate defaults for LocalStack.

### Required Manual Configuration

After running the setup, you'll need to manually add these values to your `packages/server/.env` file:

1. **reCAPTCHA Keys**: Add your `CAPTCHA_SITE_KEY` and `CAPTCHA_SECRET_KEY` from your [reCAPTCHA setup](./prerequisites.md#recaptcha-account)

2. **Draftmancer API Key**: Contact the contributors on Discord for the `DRAFTMANCER_API_KEY`

## Production Configuration

You can run a local instance of Cube Cobra against real AWS resources rather than LocalStack by:

1. Setting up S3, DynamoDB, and CloudWatch using your AWS account
2. Inserting your AWS credentials into the `packages/server/.env` file
3. Removing or modifying the `AWS_ENDPOINT` variable to point to real AWS

## Next Steps

- [AWS Configuration](./aws-configuration.md) - Setting up real AWS resources
- [LocalStack Setup](./localstack-setup.md) - Detailed LocalStack configuration
