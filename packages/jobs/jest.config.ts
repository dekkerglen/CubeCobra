import type { Config } from 'jest';

const jestConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: true,
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

export default jestConfig;
