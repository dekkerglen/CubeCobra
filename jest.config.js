module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  testMatch: [
    '**/tests/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '!**/tests/test-utils/*' // Ignore the test-utils code
  ],

  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'text'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
  ],

  moduleNameMapper: {
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
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js'
  },

  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],

  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './babel.config.js' }]
  },

  testPathIgnorePatterns: ['/node_modules/', '/build/'],
};