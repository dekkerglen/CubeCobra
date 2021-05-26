module.exports = {
  moduleDirectories: ['src', 'node_modules'],
  testPathIgnorePatterns: ['<rootDir>/public/', '<rootDir>/__tests__/helpers/'],
  transform: {
    '^.+\\.jsx?$': require.resolve('babel-jest'),
  },
  transformIgnorePatterns: ['node_modules/(?!react-dnd|dnd-core|react-syntax-highlighter)'],
};
