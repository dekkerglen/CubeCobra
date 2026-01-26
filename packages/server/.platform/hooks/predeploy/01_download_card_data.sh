#!/bin/bash
# This script runs before the application is started during deployment
# It downloads the card data so the server can start immediately

set -e

echo "Running pre-deployment initialization..."

# Change to the application directory
cd /var/app/staging

# Run the initialization script using Node
echo "Downloading card data from S3..."
node -e "
const { updateCardbase } = require('./dist/server/src/serverutils/updatecards');

updateCardbase('private', process.env.DATA_BUCKET || 'cubecobra-data')
  .then(() => {
    console.log('Card data downloaded successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to download card data:', err);
    process.exit(1);
  });
"

echo "Pre-deployment initialization complete"
