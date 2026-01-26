#!/bin/bash
# This hook runs after npm install but before the app starts
set -e

echo "Downloading card data from S3..."

node -e "
require('module-alias/register');
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

echo "Card data download complete"
