#!/usr/bin/env node
// Convert Scryfall art_crop JPGs -> webp for the cards already seeded in cardimages/.
//
//   node packages/scripts/seed-art-crop.mjs --src D:\scryfall\art_crop --dest D:\Repos\CubeCobra\cardimages
//
// Scryfall ships no webp art_crop, so we convert from the JPG snapshot with sharp.
// Only ids already present under --dest are converted — this keeps us aligned to
// the English normal/small set and avoids converting the ~540k all-language JPGs.
// Idempotent: an output that already exists is skipped, so it's safe to re-run/resume.
//
// Optional flags: --quality <n> (default 80), --concurrency <n> (default cpu count),
//                 --limit <n> (cap conversions, for a quick test run).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const args = parseArgs(process.argv.slice(2));
if (!args.src || !args.dest) {
  console.error(
    'Usage: node seed-art-crop.mjs --src <art_crop-dir> --dest <cardimages-dir> [--quality 80] [--concurrency N] [--limit N]',
  );
  process.exit(1);
}

const srcRoot = resolveArtCropTop(path.resolve(args.src));
const destDir = path.resolve(args.dest);
const quality = args.quality ? parseInt(args.quality, 10) : 80;
const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : Math.max(2, os.cpus().length);
const limit = args.limit ? parseInt(args.limit, 10) : Infinity;

if (!srcRoot) {
  console.error(`Could not find front/ or back/ under ${args.src}`);
  process.exit(1);
}

console.log(`scanning ${destDir} for seeded ids ...`);
const ids = fs
  .readdirSync(destDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name[0] !== '.')
  .map((e) => e.name);

// Queue a conversion per existing JPG whose webp isn't already written.
const tasks = [];
for (const id of ids) {
  if (tasks.length >= limit) break;
  const a = id[0];
  const b = id[1];
  const faces = [
    { jpg: path.join(srcRoot, 'front', a, b, `${id}.jpg`), out: path.join(destDir, id, 'art_crop.webp') },
    { jpg: path.join(srcRoot, 'back', a, b, `${id}.jpg`), out: path.join(destDir, id, 'art_crop_back.webp') },
  ];
  for (const f of faces) {
    if (tasks.length >= limit) break;
    if (fs.existsSync(f.jpg) && !fs.existsSync(f.out)) tasks.push(f);
  }
}

console.log(
  `ids: ${ids.length} | conversions queued: ${tasks.length} | quality: ${quality} | concurrency: ${concurrency}`,
);

let done = 0;
let failed = 0;
await runPool(tasks, concurrency, async (t) => {
  try {
    await sharp(t.jpg).webp({ quality }).toFile(t.out);
  } catch (e) {
    failed++;
    if (failed <= 10) console.error(`FAIL ${t.jpg}: ${e.message}`);
  }
  if (++done % 5000 === 0) console.log(`  ...${done}/${tasks.length}`);
});

console.log(`DONE. converted ${done - failed}, failed ${failed}, of ${tasks.length} queued`);

// Simple fixed-size async worker pool.
async function runPool(items, n, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

function resolveArtCropTop(src) {
  const candidates = [path.join(src, 'art_crop', 'art_crop'), path.join(src, 'art_crop'), src];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'front')) || fs.existsSync(path.join(c, 'back'))) return c;
  }
  return null;
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
