module.exports = {
  testPathIgnorePatterns: ['<rootDir>/public/'],
  transform: {
    '^.+\\.jsx?$': require.resolve('babel-jest'),
  },
};