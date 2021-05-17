#!/bin/sh
node jobs/populate_embeddings.js
node jobs/clean_cubes.js
rm -r exports/
node --max-old-space-size=8192 download_drafts.js
node --max-old-space-size=8192 download_cubes.js
node --max-old-space-size=8192 download_decks.js
tar -cJf exports.tar.xz exports/
aws s3 cp exports.tar.xz s3://cubecobra/exports.tar.xz
