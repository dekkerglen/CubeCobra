#!/bin/bash
# This hook runs after npm install but before the app starts
set -e

echo "Downloading ML models from S3..."

node -e "
require('module-alias/register');
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

echo "ML models download complete"
