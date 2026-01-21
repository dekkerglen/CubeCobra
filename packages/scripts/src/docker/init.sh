#!/bin/sh

# Address dubious ownership git error for Windows
git config --global --add safe.directory /home/node/app
# Install and build
echo "Installing packages"
npm install
# Reinstall tfjs-node to force a re-compile
echo "Fixing tensorflow"
cd packages/server
rm -rf 'node_modules/@tensorflow/tfjs-node'
npm install @tensorflow/tfjs-node --build-from-source --build-addon-from-source
cd ../../
echo "Building the client"
npm run build --workspace=packages/client
echo "Doing first time env setup"
npm run setup:local:env --workspace=packages/scripts
echo "Building the server"
npm run build --workspace=packages/server
# Given the time it takes to do npm install/build, we assume localstack has started and completed its init to setup the S3 bucket
npm run create-mock-files --workspace=packages/scripts
echo "Creating local aws resources"
npm run cdk:local --workspace=packages/cdk
echo "Updating combo data"
npm run update-combos --workspace=packages/jobs
echo "Updating card data"
npm run update-cards --workspace=packages/jobs
