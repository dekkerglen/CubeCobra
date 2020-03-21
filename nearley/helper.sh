#!/bin/bash

{
    tail -n +4 src/generated/filtering/cardFilters.js | head -n -6;
    echo "; export default grammar;"
} | cat - > src/generated/filtering/cardFilters.js.tmp && mv src/generated/filtering/cardFilters.js.tmp src/generated/filtering/cardFilters.js
