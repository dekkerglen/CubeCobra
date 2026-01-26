#!/bin/bash
# This script runs before the application is started during deployment
# It downloads the ML models so the recommender service can start immediately

set -e

echo "Running pre-deployment initialization for recommender service..."

# Change to the application directory
cd /var/app/staging

# Run the initialization script using Node
echo "Downloading ML models from S3..."
node -e "
const { downloadModelsFromS3 } = require('./dist/recommenderService/src/mlutils/downloadModel');

downloadModelsFromS3('', process.env.DATA_BUCKET || 'cubecobra-data')
  .then(() => {
    console.log('ML models downloaded successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to download ML models:', err);
    process.exit(1);
  });
"

echo "Pre-deployment initialization complete"
