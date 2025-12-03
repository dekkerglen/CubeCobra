const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Plugin to replace ml.ts imports with ml-stub.ts
const mlStubPlugin = {
  name: 'ml-stub',
  setup(build) {
    build.onResolve({ filter: /serverutils\/ml$/ }, (args) => {
      return {
        path: path.resolve(__dirname, '../server/src/serverutils/ml-stub.ts'),
      };
    });
  },
};

// Plugin to add proper CommonJS export
const exportFixPlugin = {
  name: 'export-fix',
  setup(build) {
    build.onEnd((result) => {
      const outfile = path.resolve(__dirname, 'dist/handler.js');
      let contents = fs.readFileSync(outfile, 'utf8');
      
      // Replace the dead code annotation with actual export
      contents = contents.replace(
        /0 && \(module\.exports = \{\s*handler\s*\}\);/,
        'module.exports = { handler };'
      );
      
      fs.writeFileSync(outfile, contents);
    });
  },
};

esbuild
  .build({
    entryPoints: ['src/handler.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: 'dist/handler.js',
    format: 'cjs',
    mainFields: ['module', 'main'],
    plugins: [mlStubPlugin, exportFixPlugin],
    alias: {
      '@utils': '../utils/src',
      '@server': '../server/src',
      serverutils: '../server/src/serverutils',
      routes: '../server/src/routes',
      dynamo: '../server/src/dynamo',
      seedrandom: '../../node_modules/seedrandom/seedrandom.js',
    },
    external: [
      '@mapbox/node-pre-gyp',
      'mock-aws-s3',
      'nock',
      'aws-sdk',
      '@aws-sdk/*',
    ],
    logOverride: {
      'commonjs-variable-in-esm': 'silent',
    },
  })
  .catch(() => process.exit(1));
