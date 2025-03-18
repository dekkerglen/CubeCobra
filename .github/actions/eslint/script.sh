#!/bin/bash
set -e

# Get files changed between base and head refs of the PR
FILES=$(git diff --name-only --diff-filter=ACMR "$INPUT_BASE_SHA"..."$INPUT_BRANCH_SHA")

if [ "${INPUT_PRINT_CHANGED_FILES}" == "true" ]
then
    echo "Changed files:"
    echo "#####################"
    for f in "${FILES[@]}"
    do
        echo "$f"
    done
    echo ""
    echo ""
fi

if [ ${#FILES[@]} -ne 0 ]
then
    # Pass them through ESLint
    echo "ESLint output":
    echo "#####################"

    # Path to ESLint executable aligned with prettier script
    # Don't quote ESLINT flags or FILES, as need to be treated as separate arguments
    "$(npm root)"/.bin/eslint -c "${INPUT_CONFIG_PATH}" $INPUT_ESLINT_FLAGS ${FILES[@]}
fi

