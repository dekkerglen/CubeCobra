#!/bin/sh

# Install and build
npm install
# Reinstall tfjs-node to force a re-compile
rm -rf 'node_modules/@tensorflow/tfjs-node'
npm install @tensorflow/tfjs-node --build-from-source --build-addon-from-source
npm run build
# Given the time it takes to do npm install/build, we assume localstack has started and completed its init to setup the S3 bucket
npm run setup:local:files
npm run setup:local:db
npm run update-combos
npm run update-cards