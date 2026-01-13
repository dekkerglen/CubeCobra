#!/bin/sh

# Address dubious ownership git error for Windows
git config --global --add safe.directory /home/node/app
npm run dev --workspace=packages/server & npm run start --workspace=packages/client