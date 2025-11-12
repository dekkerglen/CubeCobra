#!/bin/bash
set -e

if [ -z "$INPUT_BASE_SHA" ] || [ -z "$INPUT_BRANCH_SHA" ]
then
    echo "Skipping ESLint changed files check because missing one or both SHAs"
    exit 0
fi

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

    # Use npm exec to run eslint with proper module resolution
    # Don't quote ESLINT flags or FILES, as need to be treated as separate arguments
    npm exec -- eslint -c "${INPUT_CONFIG_PATH}" $INPUT_ESLINT_FLAGS ${FILES[@]}
fi

