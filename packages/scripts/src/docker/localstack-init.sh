#!/bin/sh

AWS_REGION=us-east-1
# Create bucket
awslocal s3 mb s3://local
# Create the static-assets bucket used by CI to smoke-test the upload path.
# Production runs against a real bucket fronted by CloudFront; locally we
# only need the bucket to exist so `npm run upload-assets` succeeds.
awslocal s3 mb s3://local-assets
# Create email identity
awslocal ses verify-email-identity --email support@cubecobra.com