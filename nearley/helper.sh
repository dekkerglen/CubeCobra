#!/bin/sh
set -e

mkdir -p src/client/generated/filtering;
nearleyc nearley/cardFilters.ne -o src/client/generated/filtering/cardFilters.js;
{
    tail -n +4 src/client/generated/filtering/cardFilters.js |  awk '{a[i++]=$0} END {for (j=i-1; j>=0;) print a[j--] }' | tail -n +7 | awk '{a[i++]=$0} END {for (j=i-1; j>=0;) print a[j--] }';
    echo "; export default grammar;"
} | cat - > src/client/generated/filtering/cardFilters.js.tmp && mv src/client/generated/filtering/cardFilters.js.tmp src/client/generated/filtering/cardFilters.js
