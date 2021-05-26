#!/bin/sh
node jobs/populate_embeddings.js
node jobs/clean_cubes.js
export NOW=$(date +"%Y%m%d")
# This is optional, but keeps disk usage from ballooning on the machine.
rm -r exports/
mkdir -p exports/$NOW
node --max-old-space-size=8192 jobs/download_drafts.js $NOW
node --max-old-space-size=8192 jobs/download_cubes.js $NOW
node --max-old-space-size=8192 jobs/download_decks.js $NOW
tar -cJf exports.tar.xz exports/$NOW
node --max-old-space-size=8192 jobs/upload_to_aws.js $NOW
