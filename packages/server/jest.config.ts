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
  coverageReporters: ['json', 'text'],
  collectCoverageFrom: ['src/**/*.{js,ts,tsx}', '!src/**/*.d.ts', '!src/**/index.{js,ts}', '!src/client/**'],
};

export default jestConfig;
