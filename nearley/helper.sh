#!/bin/sh
set -e

mkdir -p dist/generated/filtering;
nearleyc nearley/cubeFilters.ne -o dist/generated/filtering/cubeFilters.js;

mkdir -p src/generated/filtering;
nearleyc nearley/cardFilters.ne -o src/generated/filtering/cardFilters.js;
{
    tail -n +4 src/generated/filtering/cardFilters.js |  awk '{a[i++]=$0} END {for (j=i-1; j>=0;) print a[j--] }' | tail -n +7 | awk '{a[i++]=$0} END {for (j=i-1; j>=0;) print a[j--] }';
    echo "; export default grammar;"
} | cat - > src/generated/filtering/cardFilters.js.tmp && mv src/generated/filtering/cardFilters.js.tmp src/generated/filtering/cardFilters.js
