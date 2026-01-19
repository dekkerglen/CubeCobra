const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist/handler.js',
  external: ['aws-sdk'],
  sourcemap: true,
  minify: true,
  format: 'esm',
  banner: {
    js: "import { createRequire } from 'module';import { fileURLToPath } from 'url';import { dirname } from 'path';const require = createRequire(import.meta.url);const __filename = fileURLToPath(import.meta.url);const __dirname = dirname(__filename);",
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
