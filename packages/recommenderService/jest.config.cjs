// TS is type-stripped by babel-jest (same setup as the server and client packages); types are
// checked separately with `npm run type-check`.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|js)$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-typescript'] }],
  },
  testMatch: ['<rootDir>/test/**/*.test.ts'],
};
