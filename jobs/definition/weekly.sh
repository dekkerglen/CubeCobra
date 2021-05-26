#!/bin/sh
node jobs/populate_embeddings.js
node jobs/clean_cubes.js
export TEMP=tmp/data
export OUTPUT_DIR=exports/
export OUTPUT_FILE=$OUTPUT_DIR/$(date +"%Y%m%d").tar.xz
# This is optional, but keeps disk usage from ballooning on the machine.
rm -r $TEMP $OUTPUT_DIR
mkdir -p $TEMP
mkdir -p $OUTPUT_DIR
node --max-old-space-size=8192 jobs/download_drafts.js $TEMP
node --max-old-space-size=8192 jobs/download_cubes.js  $TEMP
node --max-old-space-size=8192 jobs/download_decks.js  $TEMP
tar -cJf $OUTPUT_FILE $TEMP
node --max-old-space-size=8192 jobs/upload_to_aws.js $OUTPUT_DIR $OUTPUT_DIR
