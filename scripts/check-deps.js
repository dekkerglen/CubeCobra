#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Walk every workspace and print any bare-module import that isn't declared
 * in that workspace's package.json (deps + devDeps + peer + optional).
 *
 * Catches the class of bug that bites prod-only `npm install --omit=dev`:
 * a runtime-required package compiles fine because dev-deps or hoisted
 * packages from another workspace satisfy the import, but the production
 * install doesn't include it and the server explodes on boot.
 *
 * Usage from repo root:
 *   node scripts/check-deps.js
 *
 * Exits with code 1 if anything is missing, so wire it into pre-commit /
 * pre-push / CI.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Treat these as resolvable without an explicit dep entry
const BUILTINS = new Set([
  'fs',
  'path',
  'os',
  'util',
  'stream',
  'crypto',
  'http',
  'https',
  'url',
  'events',
  'child_process',
  'net',
  'querystring',
  'zlib',
  'buffer',
  'assert',
  'dns',
  'tls',
  'tty',
  'readline',
  'timers',
  'process',
  'string_decoder',
  'async_hooks',
  'perf_hooks',
  'module',
  'inspector',
  'vm',
  'v8',
  'worker_threads',
  'cluster',
  'console',
  'constants',
  'dgram',
  'domain',
  'punycode',
  'repl',
  'sys',
  'test',
]);

// Internal path aliases used in tsconfig paths / module-alias. Cross-workspace
// aliases (@server/..., @client/..., @jobs/...) are also internal — they
// resolve via tsconfig paths to another workspace's source.
const INTERNAL_ALIAS_PREFIXES = [
  '@utils',
  '@cubecobra',
  '@server',
  '@client',
  '@jobs',
  '@recommender',
  'analytics/',
  'components/',
  'contexts/',
  'datatypes/',
  'drafting/',
  'filtering/',
  'generated/',
  'hooks/',
  'layouts/',
  'markdown/',
  'pages/',
  'res/',
  'utils/',
  'dynamo/',
  'router/',
  'serverutils/',
  'mlutils/',
  'types/',
];

// Per-workspace `types` alias (resolves to the workspace's own types/ dir).
const EXACT_INTERNAL = new Set(['types']);

const importRe = /(?:^|\s)(?:import\s+(?:[^'"]*?\sfrom\s)?|require\()\s*['"]([^'"]+)['"]/gm;

function pkgNameOf(spec) {
  if (spec.startsWith('node:')) return spec;
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0];
}

function isInternal(spec) {
  if (spec.startsWith('.')) return true;
  const bareBuiltin = spec.replace(/^node:/, '');
  if (BUILTINS.has(bareBuiltin)) return true;
  if (spec.startsWith('@cubecobra/') || spec === '@utils' || spec.startsWith('@utils/')) return true;
  if (EXACT_INTERNAL.has(spec)) return true;
  for (const prefix of INTERNAL_ALIAS_PREFIXES) {
    if (spec === prefix.replace(/\/$/, '') || spec.startsWith(prefix)) return true;
  }
  return false;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) out.push(full);
  }
  return out;
}

function declaredDepsOf(pkgJsonPath) {
  const pj = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const set = new Set();
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    Object.keys(pj[key] || {}).forEach((d) => set.add(d));
  }
  return set;
}

const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const workspaces = fs
  .readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

let totalMissing = 0;
for (const ws of workspaces) {
  const pkgDir = path.join(PACKAGES_DIR, ws);
  const pkgJson = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJson)) continue;

  const declared = declaredDepsOf(pkgJson);
  const files = walk(pkgDir);
  const imports = new Set();

  for (const file of files) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let m;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(src))) {
      const spec = m[1];
      if (isInternal(spec)) continue;
      imports.add({ name: pkgNameOf(spec), file });
    }
  }

  const missing = new Map(); // name -> first file that imports it
  for (const { name, file } of imports) {
    if (!declared.has(name) && !missing.has(name)) {
      missing.set(name, file);
    }
  }

  if (missing.size > 0) {
    console.log(`\npackages/${ws}: ${missing.size} undeclared import${missing.size === 1 ? '' : 's'}`);
    for (const [name, file] of [...missing.entries()].sort()) {
      console.log(`  - ${name}  (${path.relative(REPO_ROOT, file)})`);
      totalMissing += 1;
    }
  }
}

if (totalMissing === 0) {
  console.log('All workspace imports are declared.');
  process.exit(0);
}

console.log(`\n${totalMissing} undeclared import${totalMissing === 1 ? '' : 's'} found.`);
process.exit(1);
