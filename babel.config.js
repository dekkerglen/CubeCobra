module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['@babel/preset-env', {
        useBuiltIns: 'usage',
        corejs: 2,
      }],
      '@babel/preset-react',
    ],
  };
};
