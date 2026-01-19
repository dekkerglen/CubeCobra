const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/handler.js',
  external: ['aws-sdk', '@aws-sdk/*'],
  sourcemap: true,
  minify: true,
  format: 'cjs',
  banner: {
    js: "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
  },
  alias: {
    '@server': path.resolve(__dirname, '../server/src'),
    '@utils': path.resolve(__dirname, '../utils/src'),
  },
};

if (watch) {
  esbuild
    .context(buildOptions)
    .then((ctx) => {
      console.log('Watching for changes...');
      return ctx.watch();
    })
    .catch(() => process.exit(1));
} else {
  esbuild.build(buildOptions).catch(() => process.exit(1));
}
