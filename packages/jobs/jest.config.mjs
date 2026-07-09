// Jest config is authored as .mjs (not .ts): TS7 native has no JS API, so Jest can no longer
// load a TypeScript config file via ts-node. Test files themselves are still TS and are
// transformed at runtime by @swc/jest (see `transform` below).
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>'],

  // Transform configuration. TS7 is the native compiler without the JS API `ts-jest` needs,
  // so TS/TSX is transformed by @swc/jest (type-stripping; type-checking is a separate step).
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
  },

  // Module resolution paths
  modulePaths: ['<rootDir>'],
  moduleDirectories: ['node_modules', 'src'],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@server/(.*)$': '<rootDir>/../server/src/$1',
    '^@utils/(.*)$': '<rootDir>/../utils/src/$1',
    '^serverutils/(.*)$': '<rootDir>/../server/src/serverutils/$1',
    '^dynamo/(.*)$': '<rootDir>/../server/src/dynamo/$1',
  },

  // Test file patterns
  testMatch: ['**/*.test.ts'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform ignore patterns - allow transforming ES modules from utils
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/types/**',
    '!src/update_*.ts',
    '!src/export_*.ts',
    '!src/repair*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Don't collect coverage on untested files to avoid executing them
  collectCoverage: false,
};
