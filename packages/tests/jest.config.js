const baseConfig = {
  preset: 'ts-jest',

  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
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
  },
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
};

module.exports = {
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

  projects: [
    {
      ...baseConfig,
      displayName: 'component-tests',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/**/*.test.tsx'], // Component tests
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
    {
      ...baseConfig,
      displayName: 'other-tests',
      testEnvironment: 'node',
      testMatch: ['**/tests/**/*.test.ts'], // Non-component tests
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};
