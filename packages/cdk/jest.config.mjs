export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
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
