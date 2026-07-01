#!/usr/bin/env node
// Seed the local card-image folder from Scryfall's CDN-snapshot webp sets.
//
//   node packages/scripts/seed-cardimages.mjs --dump <dir> --dest <cardimages-dir>
//
// For each size it takes the English webp set — grid (normal) and thumb (small) —
// and lays it out as {dest}/{scryfall_id}/{normal|small}[_back].webp.
//
// Per size, --dump may contain EITHER:
//   * the tarball        e.g. <dump>/grid.tar.gz            -> extracted, then MOVED into place
//   * a pre-extracted    e.g. <dump>/thumb/thumb/front/...  -> COPIED into place (source kept)
//                        (also accepts <dump>/thumb/front or <dump>/front)
//
// No conversion / no manifest lookup: the webp sets are English-only and each
// path encodes the scryfall_id as {top}/{front|back}/{a}/{b}/{id}.webp.
//
// art_crop is intentionally NOT handled — Scryfall ships no webp art_crop.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SIZES = [
  { tarball: 'grid.tar.gz', top: 'grid', label: 'normal' },
  { tarball: 'thumb.tar.gz', top: 'thumb', label: 'small' },
];

const args = parseArgs(process.argv.slice(2));
if (!args.dump || !args.dest) {
  console.error('Usage: node seed-cardimages.mjs --dump <dir> --dest <cardimages-dir> [--keep-stage]');
  process.exit(1);
}

const dumpDir = path.resolve(args.dump);
const destDir = path.resolve(args.dest);
fs.mkdirSync(destDir, { recursive: true });

// Staging (for tarball extraction) lives under dest so it's on the same
// filesystem — renameSync is then an instant move rather than a copy.
const stageRoot = path.join(destDir, '.stage');

let grand = 0;
for (const size of SIZES) {
  const src = resolveSource(dumpDir, size);
  if (!src) {
    console.error(`SKIP ${size.label} — no ${size.tarball} and no extracted ${size.top}/ folder under ${dumpDir}`);
    continue;
  }

  let topDir;
  let move;
  if (src.kind === 'tar') {
    console.log(`\n=== ${size.tarball} -> ${size.label} (extract + move) ===`);
    fs.mkdirSync(stageRoot, { recursive: true });
    fs.rmSync(path.join(stageRoot, size.top), { recursive: true, force: true });
    const r = spawnSync('tar', ['-xzf', src.path, '-C', stageRoot], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`tar failed for ${size.tarball} (exit ${r.status})`);
      process.exit(1);
    }
    topDir = path.join(stageRoot, size.top);
    move = true;
  } else {
    console.log(`\n=== ${src.top} -> ${size.label} (copy from pre-extracted) ===`);
    topDir = src.top;
    move = false;
  }

  const count = reorganize(topDir, destDir, size.label, move);
  console.log(`placed ${count} ${size.label} files`);
  grand += count;

  if (move) fs.rmSync(topDir, { recursive: true, force: true });
}

if (!args['keep-stage']) fs.rmSync(stageRoot, { recursive: true, force: true });
console.log(`\nDONE. ${grand} files placed under ${destDir}`);

// Decide, per size, whether --dump holds the tarball or a pre-extracted tree.
// Returns {kind:'tar', path} | {kind:'dir', top} | null.
function resolveSource(dump, size) {
  // Prefer an already-extracted tree (a valid top dir directly contains
  // front/ or back/) so we don't needlessly re-unpack the tarball.
  const candidates = [
    path.join(dump, size.top, size.top), // <dump>/thumb/thumb/front...
    path.join(dump, size.top), // <dump>/thumb/front...
    dump, // <dump>/front...
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'front')) || fs.existsSync(path.join(c, 'back'))) {
      return { kind: 'dir', top: c };
    }
  }
  // Fall back to the tarball if no extracted tree is present.
  const tarPath = path.join(dump, size.tarball);
  if (fs.existsSync(tarPath) && fs.statSync(tarPath).isFile()) {
    return { kind: 'tar', path: tarPath };
  }
  return null;
}

// Walk {top}/{front,back}/{a}/{b}/{id}.webp -> {dest}/{id}/{label}[_back].webp.
function reorganize(top, dest, label, move) {
  let n = 0;
  for (const face of ['front', 'back']) {
    const faceDir = path.join(top, face);
    if (!fs.existsSync(faceDir)) continue;
    const suffix = face === 'back' ? '_back' : '';
    for (const a of fs.readdirSync(faceDir)) {
      const aDir = path.join(faceDir, a);
      if (!fs.statSync(aDir).isDirectory()) continue;
      for (const b of fs.readdirSync(aDir)) {
        const bDir = path.join(aDir, b);
        if (!fs.statSync(bDir).isDirectory()) continue;
        for (const file of fs.readdirSync(bDir)) {
          if (!file.endsWith('.webp')) continue;
          const id = file.slice(0, -'.webp'.length);
          const outDir = path.join(dest, id);
          fs.mkdirSync(outDir, { recursive: true });
          const from = path.join(bDir, file);
          const to = path.join(outDir, `${label}${suffix}.webp`);
          if (move) fs.renameSync(from, to);
          else fs.copyFileSync(from, to);
          if (++n % 20000 === 0) console.log(`  ...${n}`);
        }
      }
    }
  }
  return n;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}
