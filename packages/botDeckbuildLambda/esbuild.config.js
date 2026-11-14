const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Replace the server's serverutils/ml with the stub: this lambda pulls in DraftDynamoDao
// (for the write-back), whose imports can reach serverutils/ml, but we never call it (bots use
// our own ./ml client). Stubbing keeps the tfjs /
// cloudwatch ml deps out of the bundle. Our own ./ml (relative) is untouched.
const mlStubPlugin = {
  name: 'ml-stub',
  setup(build) {
    build.onResolve({ filter: /serverutils\/ml$/ }, () => ({
      path: path.resolve(__dirname, '../server/src/serverutils/ml-stub.ts'),
    }));
  },
};

// Plugin to add proper CommonJS export.
const exportFixPlugin = {
  name: 'export-fix',
  setup(build) {
    build.onEnd(() => {
      const outfile = path.resolve(__dirname, 'dist/handler.js');
      let contents = fs.readFileSync(outfile, 'utf8');
      contents = contents.replace(/0 && \(module\.exports = \{\s*handler\s*\}\);/, 'module.exports = { handler };');
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
    external: ['@mapbox/node-pre-gyp', 'mock-aws-s3', 'nock', 'aws-sdk', '@aws-sdk/*'],
    logOverride: {
      'commonjs-variable-in-esm': 'silent',
    },
  })
  .catch(() => process.exit(1));
