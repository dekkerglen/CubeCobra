#!/bin/bash
set -e

# Move to the provided workdir
cd "${GITHUB_WORKSPACE}/${INPUT_WORKDIR}" || exit 1

# Install prettier
if [ ! -f "$(npm root)"/.bin/prettier ]; then
  echo "::group::🔄 Running npm install to install prettier..."
  npm install
  echo "::endgroup::"
fi

if [ ! -f "$(npm root)"/.bin/prettier ]; then
  echo "❌ Unable to locate or install prettier. Did you provide a workdir which contains a valid package.json?"
  exit 1
else
  echo ℹ️ prettier version: "$("$(npm root)"/.bin/prettier --version)"
fi

echo "::group::📝 Running prettier with reviewdog 🐶 ..."

export REVIEWDOG_GITHUB_API_TOKEN="${INPUT_GITHUB_TOKEN}"

# if reporter is github-pr-review, run prettier in write mode and report code suggestions
if [ "$INPUT_REPORTER" = "github-pr-review" ]; then
  "$(npm root)"/.bin/prettier --write "${INPUT_PRETTIER_FLAGS}" 2>&1 \
  | reviewdog \
      -efm="%E[%trror] %f: %m (%l:%c)" \
      -efm="%C[error]%r" \
      -efm="%Z[error]%r" \
      -efm="%-G%r" \
      -name="${INPUT_TOOL_NAME}" \
      -reporter="${INPUT_REPORTER}" \
      -filter-mode="${INPUT_FILTER_MODE}" \
      -fail-on-error="${INPUT_FAIL_ON_ERROR}" \
      -level="${INPUT_LEVEL}" \
      "${INPUT_REVIEWDOG_FLAGS}"
# else run prettier in check mode and report warnings and errors
else
  
  # shellcheck disable=SC2086
  "$(npm root)"/.bin/prettier --check "${INPUT_PRETTIER_FLAGS}"  2>&1 | sed --regexp-extended 's/(\[warn\].*)$/\1 File is not properly formatted./' \
  | reviewdog \
      -efm="%-G[warn] Code style issues found in the above file(s). Forgot to run Prettier%. File is not properly formatted." \
      -efm="[%tarn] %f %m" \
      -efm="%E[%trror] %f: %m (%l:%c)" \
      -efm="%C[error]%r" \
      -efm="%Z[error]%r" \
      -efm="%-G%r" \
      -name="${INPUT_TOOL_NAME}" \
      -reporter="${INPUT_REPORTER}" \
      -filter-mode="${INPUT_FILTER_MODE}" \
      -fail-on-error="${INPUT_FAIL_ON_ERROR}" \
      -level="${INPUT_LEVEL}" \
      "${INPUT_REVIEWDOG_FLAGS}"
fi

exit_code=$?
echo "::endgroup::"
exit $exit_code