// Shared helpers for the synthetic-dataset scripts: Scryfall bulk handling,
// a lazy on-disk image cache, small RNG/util helpers, and the planar
// homography math used for the perspective warp.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/stream-array.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const SCRYFALL_DIR = path.join(ROOT, 'data', 'scryfall');
export const BULK_PATH = path.join(SCRYFALL_DIR, 'all-cards.json');
export const COMPACT_PATH = path.join(SCRYFALL_DIR, 'all-cards.compact.jsonl');
export const CARDPOOL_DIR = path.join(ROOT, 'data', 'cardpool');
const SCRYFALL_CDN = 'https://cards.scryfall.io';

// Scryfall serves images at a stable, id-derived CDN path, so we can rebuild the
// URL from just the card id (the ?timestamp query is only a cache-buster).
const imgUrl = (size, id) => `${SCRYFALL_CDN}/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;

const UA = 'CubeCobra-annotator-dataset/0.1 (synthetic training data)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- tiny RNG / array utils ------------------------------------------------
export const rand = (a, b) => a + Math.random() * (b - a);
export const randint = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const deg2rad = (d) => (d * Math.PI) / 180;

// ---- Scryfall bulk ---------------------------------------------------------

// Downloads the "All Cards" bulk export if it's not already on disk. Returns the
// local path. Pass { force: true } to re-download regardless.
export async function ensureBulk({ force = false } = {}) {
  fs.mkdirSync(SCRYFALL_DIR, { recursive: true });
  if (!force && fs.existsSync(BULK_PATH) && fs.statSync(BULK_PATH).size > 100 * 1024 * 1024) {
    return BULK_PATH;
  }
  console.log('locating All Cards bulk export…');
  const meta = await fetch('https://api.scryfall.com/bulk-data', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  }).then((r) => r.json());
  const entry = (meta.data || []).find((d) => d.type === 'all_cards');
  if (!entry) throw new Error('could not find all_cards in /bulk-data');
  console.log(`downloading ${(entry.size / 1e9).toFixed(2)} GB from ${entry.download_uri}`);
  const res = await fetch(entry.download_uri, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`bulk download failed: ${res.status}`);

  // Stream straight to disk — the file is far too big to hold in memory.
  const tmp = `${BULK_PATH}.partial`;
  const out = fs.createWriteStream(tmp);
  const reader = res.body.getReader();
  let bytes = 0;
  let nextLog = 5e8;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
    if (bytes >= nextLog) {
      console.log(`  …${(bytes / 1e9).toFixed(2)} GB`);
      nextLog += 5e8;
    }
  }
  await new Promise((r) => out.end(r));
  fs.renameSync(tmp, BULK_PATH);
  console.log(`saved ${BULK_PATH} (${(bytes / 1e9).toFixed(2)} GB)`);
  return BULK_PATH;
}

// Oversized / non-standard layouts we don't generate (always oversized, so they
// don't appear in normal-sized card piles).
const SKIP_LAYOUTS = new Set(['planar', 'scheme', 'vanguard', 'emblem', 'art_series']);
// Layouts whose name bar(s) run along the card's long edge instead of the top —
// the generator needs to know, so we keep `layout` for these.
const LONG_EDGE_LAYOUTS = new Set(['split', 'room']);

// Minimal per-card record. We keep only id/name/lang (+ layout when it changes
// the name-bar geometry) and rebuild image URLs from the id at fetch time —
// storing the long URLs would bloat memory ~5x.
const projectCard = (c) => {
  if (SKIP_LAYOUTS.has(c.layout)) return null;
  const iu = c.image_uris || c.card_faces?.[0]?.image_uris;
  if (!iu?.normal) return null;
  const rec = { id: c.id, name: c.name, lang: c.lang };
  if (LONG_EDGE_LAYOUTS.has(c.layout)) rec.layout = c.layout;
  return rec;
};

// Reads the compact JSONL index into memory. Strings come from per-line
// JSON.parse, so they don't pin the source buffer.
function readCompact(langFilter) {
  console.log('loading compact card index…');
  const txt = fs.readFileSync(COMPACT_PATH, 'utf8');
  const cards = [];
  let start = 0;
  for (let i = 0; i <= txt.length; i++) {
    if (i === txt.length || txt.charCodeAt(i) === 10) {
      if (i > start) {
        const o = JSON.parse(txt.slice(start, i));
        if (!langFilter || o.lang === langFilter) cards.push(o);
      }
      start = i + 1;
    }
  }
  console.log(`  ${cards.length} cards`);
  return cards;
}

// Builds (once) and loads the compact card index from the bulk export.
//
// The bulk is multi-GB and stream-json hands back sliced strings that pin their
// source chunks, so we must NOT accumulate parsed records in memory while
// streaming — that OOMs. Instead we write each minimal record straight to a
// compact JSONL file (retaining nothing), then read that small file back.
// `langFilter` (e.g. 'en') is applied at load time, not baked into the cache.
export async function loadCardIndex({ langFilter = null } = {}) {
  const fresh =
    fs.existsSync(COMPACT_PATH) &&
    fs.existsSync(BULK_PATH) &&
    fs.statSync(COMPACT_PATH).mtimeMs >= fs.statSync(BULK_PATH).mtimeMs;
  if (fresh) return readCompact(langFilter);

  console.log('building compact index from bulk (first run is slow)…');
  const out = fs.createWriteStream(`${COMPACT_PATH}.partial`);
  let seen = 0;
  let kept = 0;
  await new Promise((resolve, reject) => {
    // stream-json 3.x components are chain() stages, not classic pipeable streams.
    const pipeline = chain([fs.createReadStream(BULK_PATH), parser(), streamArray()]);
    pipeline.on('data', ({ value }) => {
      seen++;
      const p = projectCard(value);
      if (p) {
        kept++;
        // Backpressure: pause the parser if the file write buffer fills.
        if (!out.write(`${JSON.stringify(p)}\n`)) pipeline.pause();
      }
      if (seen % 100000 === 0) console.log(`  scanned ${seen}, kept ${kept}`);
    });
    out.on('drain', () => pipeline.resume());
    pipeline.on('end', () => out.end(resolve));
    pipeline.on('error', reject);
    out.on('error', reject);
  });
  fs.renameSync(`${COMPACT_PATH}.partial`, COMPACT_PATH);
  console.log(`  wrote ${kept} cards → ${path.basename(COMPACT_PATH)}`);
  return readCompact(langFilter);
}

// ---- lazy image cache ------------------------------------------------------

async function downloadTo(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  // Write to a unique temp file then rename, so concurrent workers fetching the
  // same card can't read a half-written file.
  const tmp = `${dest}.${process.pid}.${Math.floor(Math.random() * 1e9)}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);
}

// Ensures one cached image for a card, downloading on a miss. Returns the local
// path or null if the download failed. `politeMs` is the delay applied only when
// we actually hit the network (cache hits are free).
async function ensureImage(card, size, suffix, politeMs) {
  fs.mkdirSync(CARDPOOL_DIR, { recursive: true });
  const dest = path.join(CARDPOOL_DIR, `${card.id}.${suffix}.jpg`);
  if (!fs.existsSync(dest)) {
    try {
      await downloadTo(imgUrl(size, card.id), dest);
      await sleep(politeMs);
    } catch (e) {
      console.warn(`  ${suffix} image miss for ${card.name}: ${e.message}`);
      return null;
    }
  }
  return dest;
}

// The full card image (placed into the piles) — one per placed card.
export const ensureCardImage = (card, { politeMs = 60 } = {}) => ensureImage(card, 'normal', 'card', politeMs);
// The art crop (used only as a photo background) — one per generated image.
export const ensureArtImage = (card, { politeMs = 60 } = {}) => ensureImage(card, 'art_crop', 'art', politeMs);

// ---- homography (planar perspective) ---------------------------------------

// Solves the 8x8 system for the homography mapping the 4 src points to the 4
// dst points. Returns [a,b,c,d,e,f,g,h] with h33 = 1.
export function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [X, Y] = src[i];
    const [x, y] = dst[i];
    A.push([X, Y, 1, 0, 0, 0, -x * X, -x * Y]);
    b.push(x);
    A.push([0, 0, 0, X, Y, 1, -y * X, -y * Y]);
    b.push(y);
  }
  return solve(A, b);
}

export function applyH(h, [X, Y]) {
  const d = h[6] * X + h[7] * Y + 1;
  return [(h[0] * X + h[1] * Y + h[2]) / d, (h[3] * X + h[4] * Y + h[5]) / d];
}

// Gaussian elimination with partial pivoting for an n×n system.
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

// True if point p is inside the convex quad (4 ordered corners).
export function pointInQuad(p, quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const s = Math.sign(cross);
    if (s !== 0) {
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}
