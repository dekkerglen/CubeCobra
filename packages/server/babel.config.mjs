export default (api) => {
  api.cache(true);
  return {
    presets: [
      [
        '@babel/preset-env',
        {
          modules: false,
          useBuiltIns: 'usage',
          corejs: 3,
          exclude: ['es.promise'],
        },
      ],
      '@babel/preset-react',
    ],
    plugins: [
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-runtime',
    ],
  };
};
