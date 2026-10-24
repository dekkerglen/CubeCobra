export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  // `npm run build` (tsc) emits lib/*.js next to the sources; resolve the .ts first so the tests
  // never run against stale compiled output.
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json', 'node'],
  // TS7 native has no JS API for ts-jest; transform TS via @swc/jest (type-stripping).
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true, decorators: false },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
};
