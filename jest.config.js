module.exports = {
  testPathIgnorePatterns: ['<rootDir>/public/', '<rootDir>/__tests__/helpers.js'],
  transform: {
    '^.+\\.jsx?$': require.resolve('babel-jest'),
  },
};
