module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        '@babel/preset-env',
        '@babel/preset-react',
        '@babel/preset-typescript'
      ]
    }]
  },
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@utils/(.*)$': '<rootDir>/../utils/src/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^utils/(.*)$': '<rootDir>/src/utils/$1',
    '^modals/(.*)$': '<rootDir>/src/components/modals/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^analytics/(.*)$': '<rootDir>/src/analytics/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^layouts/(.*)$': '<rootDir>/src/layouts/$1',
    '^drafting/(.*)$': '<rootDir>/src/drafting/$1',
    '^markdown/(.*)$': '<rootDir>/src/markdown/$1',
    // Map specific server imports to correct locations
    '^../../src/client/serverutils/cardutil$': '<rootDir>/../utils/src/cardutil',
    '^../../src/datatypes/(.*)$': '<rootDir>/../utils/src/datatypes/$1',
    // Handle test relative imports
    '^\\.\\.\\./server/test/test-utils/(.*)$': '<rootDir>/../server/test/test-utils/$1'
  },
  
  // Transform ignore patterns - transform everything including node_modules for our packages
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/test/**/*.test.(ts|tsx|js|jsx)'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts,tsx}'
  ],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Coverage reporters
  coverageReporters: ['json', 'text'],
  
  // Resolve extensions
  resolver: undefined
};
