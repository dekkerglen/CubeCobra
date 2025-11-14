#!/bin/sh

# Install and build
echo "Installing packages"
npm install
# Reinstall tfjs-node to force a re-compile
echo "Fixing tensorflow"
rm -rf 'node_modules/@tensorflow/tfjs-node'
npm install @tensorflow/tfjs-node --build-from-source --build-addon-from-source
echo "Building the client"
npm run build --workspace=packages/client
echo "Building the server"
npm run build --workspace=packages/server
# Given the time it takes to do npm install/build, we assume localstack has started and completed its init to setup the S3 bucket
npm run setup:local:files --workspace=packages/scripts
npm run setup:local:db --workspace=packages/scripts
echo "Updating combo data"
npm run update-combos --workspace=packages/jobs
echo "Updating card data"
npm run update-cards --workspace=packages/jobs