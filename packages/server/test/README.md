# CubeCobra Testing

This document outlines how tests are organized in the codebase.

## Test Organization

All tests reside under the `tests` folder at the root of the repository. Tests should be organized by _feature_ as much
as possible. Each feature consists of folder with an appropriate name containing one or more test files. All
tests must have the `*.test.ts` or `*.test.tsx` suffix. We also use the following naming conventions:

- `*.component.test.tsx` for React components tests
- `api.test.ts` for API/handler tests

This is important because Jest is configured to set up the test environment based on these suffixes.

Any reusable or helper code should be located in the `test-utils` folder.
