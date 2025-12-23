#!/bin/sh

AWS_REGION=us-east-1
# Create bucket
awslocal s3 mb s3://local
# Create email identity
awslocal ses verify-email-identity --email support@cubecobra.com