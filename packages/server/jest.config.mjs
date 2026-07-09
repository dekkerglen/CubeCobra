// Jest config is authored as .mjs (not .ts): TS7 native has no JS API, so Jest can no longer
// load a TypeScript config file via ts-node. Test files themselves are still TS and are
// transformed at runtime by @swc/jest / babel-jest (see `transform` below).
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>'],

  // Transform configuration. TS7 is the native (Go) compiler and no longer ships the JS
  // API `ts-jest` depended on, so TS/TSX is transformed by @swc/jest (fast, type-stripping —
  // type-checking is handled separately by `npm run type-check`). JS/JSX stays on babel-jest.
  transform: {
    '^.+\\.(ts|tsx)$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true, decorators: false },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
      },
    ],
  },

  // Module resolution paths
  modulePaths: ['<rootDir>'],
  moduleDirectories: ['node_modules', 'src'],

  // Use default resolver
  resolver: undefined,

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@client/(.*)$': '<rootDir>/../client/src/$1',
    '^@jobs/(.*)$': '<rootDir>/../jobs/src/$1',
    '^@utils/(.*)$': '<rootDir>/../utils/src/$1',
    '^serverutils/(.*)$': '<rootDir>/src/serverutils/$1',
    '^router/(.*)$': '<rootDir>/src/router/$1',
    '^dynamo/(.*)$': '<rootDir>/src/dynamo/$1',
    '^types/(.*)$': '<rootDir>/src/types/$1',
  },

  // Transform ignore patterns
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],

  // Test file patterns
  testMatch: ['**/*.test.ts'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'json-summary', 'text', 'lcov'],
  collectCoverageFrom: ['src/**/*.{js,ts,tsx}', '!src/**/*.d.ts', '!src/**/index.{js,ts}', '!src/client/**'],
};
