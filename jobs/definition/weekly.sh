#!/bin/sh
node jobs/populate_embeddings.js
node jobs/clean_cubes.js
node jobs/download_cubes.js
node --max-old-space-size=8192 --expose_gc jobs/populate_analytics.js
