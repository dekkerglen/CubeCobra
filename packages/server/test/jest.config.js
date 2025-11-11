module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true
    }],
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
    '^analytics/(.*)$': '<rootDir>/src/client/analytics/$1',
    '^components/(.*)$': '<rootDir>/src/client/components/$1',
    '^contexts/(.*)$': '<rootDir>/src/client/contexts/$1',
    '^datatypes/(.*)$': '<rootDir>/src/datatypes/$1',
    '^drafting/(.*)$': '<rootDir>/src/client/drafting/$1',
    '^filtering/(.*)$': '<rootDir>/src/client/filtering/$1',
    '^generated/(.*)$': '<rootDir>/src/client/generated/$1',
    '^hooks/(.*)$': '<rootDir>/src/client/hooks/$1',
    '^layouts/(.*)$': '<rootDir>/src/client/layouts/$1',
    '^markdown/(.*)$': '<rootDir>/src/client/markdown/$1',
    '^pages/(.*)$': '<rootDir>/src/client/pages/$1',
    '^res/(.*)$': '<rootDir>/src/client/res/$1',
    '^utils/(.*)$': '<rootDir>/src/client/utils/$1',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  
  // Test file patterns
  testMatch: [
    '**/*.test.ts'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'text'],
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    'src/dynamo/models/*.js',
    'src/client/filtering/*.js',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
  ],
};
