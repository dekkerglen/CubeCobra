const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['src/handler.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: 'dist/handler.js',
    format: 'cjs',
    alias: {
      '@utils': '../utils/src',
      '@server': '../server/src',
      serverutils: '../server/src/serverutils',
      routes: '../server/src/routes',
      dynamo: '../server/src/dynamo',
    },
    external: [
      '@mapbox/node-pre-gyp',
      'mock-aws-s3',
      'nock',
      'aws-sdk',
    ],
    logOverride: {
      'commonjs-variable-in-esm': 'silent',
    },
  })
  .catch(() => process.exit(1));
