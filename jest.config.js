module.exports = {
  moduleDirectories: ['src', 'node_modules'],
  testPathIgnorePatterns: ['<rootDir>/public/', '<rootDir>/__tests__/helpers.js'],
  transform: {
    '^.+\\.jsx?$': require.resolve('babel-jest'),
  },
  transformIgnorePatterns: ['node_modules/(?!react-dnd|dnd-core|react-syntax-highlighter)'],
};
