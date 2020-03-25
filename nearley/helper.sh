#!/bin/sh
set -e

mkdir -p dist/generated/filtering;
nearleyc nearley/cubeFilters.ne -o dist/generated/filtering/cubeFilters.js;

mkdir -p src/generated/filtering;
nearleyc nearley/cardFilters.ne -o src/generated/filtering/cardFilters.js;
{
    tail -n +4 src/generated/filtering/cardFilters.js | head -n -6;
    echo "; export default grammar;"
} | cat - > src/generated/filtering/cardFilters.js.tmp && mv src/generated/filtering/cardFilters.js.tmp src/generated/filtering/cardFilters.js
