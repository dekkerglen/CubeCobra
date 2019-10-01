#!/bin/bash

set -e # exit on error
set +x

cd "$(dirname "$0")"/..

if [ $# -eq 0 ]; then
    echo "Usage: $0 stage"
    echo
    echo "Make a demo named stage."
    exit 1
fi

if ! [ -e demos/config.yml ]; then
    echo "Create a config file at demos/config.yml that looks like this:"
    echo "mongodbUrl: https://user:pass@mongo/database"
    exit 1
fi

if ! which aws >/dev/null; then
    echo "Install the AWS CLI: pip3 install awscli."
    exit 1
fi

stage=$1
bucket="cubecobra-$stage-carddb"

if ! [ -d demos/deps/nodejs/node_modules ]; then
    echo "Setting up dependency layer..."
    mkdir -p demos/deps/nodejs
    cd demos/deps/nodejs
    ln -s ../../../package.json .
    npm i --production
    cd ../../..
fi

if ! [ -d demos/canvas/nodejs/node_modules/canvas ]; then
    echo "Setting up AWS-native canvas installation..."
    mkdir -p demos/canvas/nodejs
    cd demos/canvas/nodejs
    echo '{}' > package.json
    npm i canvas --target_arch=x64 --target_platform=linux --target_libc=glibc
    cd ../../..
fi

if ! [ -e demos/canvas-lib64-layer.zip ]; then
    echo "Downloading canvas lib fix..."
    cd demos
    wget https://github.com/jwerre/node-canvas-lambda/raw/master/canvas-lib64-layer.zip
    cd ..
fi

echo "Running sls deploy. This may take a while..."
echo

sls deploy --stage="$stage"

echo
echo "Uploading carddb to AWS bucket $bucket..."
echo
if ! [ -d private/cards.json ]; then
    echo "Building carddb..."
    node force_update.js
fi
aws s3 sync private/ "s3://$bucket/"
