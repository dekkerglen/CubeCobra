#!/bin/sh
node jobs/populate_embeddings.js
node jobs/clean_cubes.js
node jobs/download_cubes.js