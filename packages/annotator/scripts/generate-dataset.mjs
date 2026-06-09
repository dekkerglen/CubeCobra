// Synthetic deck-photo generator.
//
// Builds fake "pile of cards thrown on a table" photos with perfect ground-truth
// name-bar labels, to train the detector without hand-labeling 46k real photos.
//
// Pipeline per image:
//   1. random card art_crop as the table background
//   2. cards placed in distinct, mostly-separated overlapping stacks, each card
//      rotated by its stack's tilt + a ±PITCH_JITTER_DEG per-card wobble
//   3. proper occlusion: a name bar is kept only if enough of it is uncovered by
//      cards on top of it, and only if it lands inside the frame
//   4. a random keystone perspective warp, with global brightness/contrast jitter
//   5. glare highlights
//   6. a 0/90/180/270 whole-image rotation
// Ground truth is stored as perspective-correct quads, normalized to the final
// (post-rotation) image. Output goes to data/synthetic/ so it's never confused
// with real captures.
//
//   node scripts/download-bulk.mjs      # once
//   node scripts/generate-dataset.mjs
//
// Card source is the Scryfall All Cards bulk (streamed into memory by the main
// thread); rendering is fanned out across worker threads, and card images are
// lazy-downloaded and cached on disk in data/cardpool/ as they're first used.

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  ROOT,
  BULK_PATH,
  loadCardIndex,
  ensureCardImage,
  ensureArtImage,
  rand,
  randint,
  choice,
  deg2rad,
  computeHomography,
  applyH,
  pointInQuad,
} from './lib.mjs';

// ---- knobs -----------------------------------------------------------------
const NUM_IMAGES = 99990; // how many synthetic photos to generate
const MIN_CARDS = 30; // fewest cards in a photo
const MAX_CARDS = 60; // most cards in a photo
const LANG_FILTER = null; // e.g. 'en' to restrict to English printings; null = all
const WORKERS = 0; // render threads; 0 = auto (CPU count - 1)

const BASE_LONG_EDGE = 1400; // longest image side before rotation (px)
const ASPECTS = [[4, 3], [3, 4], [16, 9], [3, 2], [1, 1]]; // frame shapes to vary
const CARD_SCALE_MIN = 0.12; // card width as a fraction of image width…
const CARD_SCALE_MAX = 0.22; // …picked once per image (shared, like the real tool)

const PITCH_JITTER_DEG = 5; // per-card wobble around the stack tilt
const STACK_TILT_DEG = 18; // a stack's overall lean
const STACK_STEP_FRAC = [0.13, 0.21]; // fan offset down the stack, as ×card height
const STACK_LATERAL_FRAC = 0.04; // sideways jitter per card, as ×card width
const STACK_MIN = 2; // cards per stack lower bound
const STACK_MAX = 7; // cards per stack upper bound
const STACK_SEP_FACTOR = 2.0; // min spacing between stack anchors, as ×card width

const NAME_CENTER_FRAC = 0.085; // name-bar center, as fraction of card height from top
const NAME_W_FRAC = 0.86; // name-bar length, as fraction of card width
const NAME_ASPECT = 7.5; // name-bar length:thickness (lower = taller capture box)
const VIS_THRESH = 0.55; // keep a label only if ≥ this fraction is unoccluded
const OCC_NX = 10; // occlusion sample grid along the bar…
const OCC_NY = 3; // …and across it

const BRIGHTNESS_RANGE = [0.55, 1.1]; // global multiply (<1 = darker)
const CONTRAST_RANGE = [0.85, 1.35]; // global contrast factor
const PERSP_AMOUNT = 0.1; // max corner inset for the keystone warp (×dimension)
const GLARE_MIN = 2;
const GLARE_MAX = 5;
const GLARE_ALPHA = [0.15, 0.4]; // additive glare strength
const JPEG_QUALITY = 82;
// ----------------------------------------------------------------------------

const OUT_DIR = path.join(ROOT, 'data', 'synthetic');
const IMG_DIR = path.join(OUT_DIR, 'images');
const ANN_DIR = path.join(OUT_DIR, 'annotations');

// A horizontal name bar (long axis along card width) centered at (cx, cy).
function hBar(cx, cy, len) {
  const t = len / NAME_ASPECT;
  return [
    [cx - len / 2, cy - t / 2],
    [cx + len / 2, cy - t / 2],
    [cx + len / 2, cy + t / 2],
    [cx - len / 2, cy + t / 2],
  ];
}

// A vertical name bar (long axis along card height) centered at (cx, cy).
// Split/room names are read sideways (rotated 90° CCW), so corner 0 is the
// text-start/outer corner and 0→1 runs along the long/text axis — same corner
// convention as hBar, so a crop deskews to upright readable text.
function vBar(cx, cy, len) {
  const t = len / NAME_ASPECT;
  return [
    [cx - t / 2, cy + len / 2], // text start, letter-tops side
    [cx - t / 2, cy - len / 2], // text end (0→1 = long axis)
    [cx + t / 2, cy - len / 2],
    [cx + t / 2, cy + len / 2],
  ];
}

// Card-local name-bar quad(s) (origin = card center, before card rotation).
// Most cards have one bar across the top; split/room (and fuse, a split keyword)
// are read sideways, so each half's name runs vertically along the left edge.
// (Aftermath's top half is actually upright; it's rare and folded in here.)
function nameBars(card, cardW, cardH) {
  if (card.layout === 'split' || card.layout === 'room') {
    const len = NAME_W_FRAC * (cardH / 2); // spans most of each half's long edge
    const cx = -cardW / 2 + NAME_CENTER_FRAC * cardW; // near the left edge
    return [vBar(cx, -cardH / 4, len), vBar(cx, cardH / 4, len)];
  }
  return [hBar(0, -cardH / 2 + NAME_CENTER_FRAC * cardH, NAME_W_FRAC * cardW)];
}

// Rotate local points by angle (deg) and translate to (cx, cy).
function placeQuad(local, angleDeg, cx, cy) {
  const a = deg2rad(angleDeg);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return local.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);
}

// A point inside a (possibly skewed) quad at fractional (u, v) ∈ [0,1]².
function quadPoint(q, u, v) {
  const top = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
  const bot = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
  return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
}

// Scatter stack anchors with a minimum separation (rejection sampling) so stacks
// land as distinct clumps instead of piling onto each other.
function placeAnchors(count, W, H, cardW, cardH) {
  const margin = cardH * 0.5; // keep stacks mostly inside the frame
  const minSep = cardW * STACK_SEP_FACTOR;
  const lo = (m, hi) => (hi - 2 * m > 0 ? [m, hi - m] : [hi / 2, hi / 2]);
  const [xlo, xhi] = lo(margin, W);
  const [ylo, yhi] = lo(margin, H);
  const anchors = [];
  for (let i = 0; i < count; i++) {
    let bestP = null;
    let bestD = -1;
    for (let tries = 0; tries < 30; tries++) {
      const p = [rand(xlo, xhi), rand(ylo, yhi)];
      const d = anchors.length ? Math.min(...anchors.map((a) => Math.hypot(a[0] - p[0], a[1] - p[1]))) : Infinity;
      if (d >= minSep) {
        bestP = p;
        break;
      }
      if (d > bestD) {
        bestD = d;
        bestP = p;
      }
    }
    anchors.push(bestP);
  }
  return anchors;
}

// Lay cards out in distinct, mostly-separated overlapping stacks. Returns
// placements in draw order (earlier = further back; later cards drawn on top).
function buildLayout(n, W, H, cardW, cardH) {
  // Variable stack sizes that sum to ~n.
  const sizes = [];
  let remaining = n;
  while (remaining > 0) {
    const s = Math.min(remaining, randint(STACK_MIN, STACK_MAX));
    sizes.push(s);
    remaining -= s;
  }
  const anchors = placeAnchors(sizes.length, W, H, cardW, cardH);

  const placements = [];
  sizes.forEach((size, si) => {
    const anchor = anchors[si];
    const baseAngle = rand(-STACK_TILT_DEG, STACK_TILT_DEG);
    const a = deg2rad(baseAngle);
    const down = [Math.sin(a), Math.cos(a)]; // card "down" direction in image space
    const perp = [Math.cos(a), -Math.sin(a)];
    const step = cardH * rand(STACK_STEP_FRAC[0], STACK_STEP_FRAC[1]);
    const start = (-(size - 1) / 2) * step; // center the fan on the anchor
    for (let k = 0; k < size; k++) {
      const along = start + k * step;
      const lateral = rand(-1, 1) * cardW * STACK_LATERAL_FRAC;
      placements.push({
        cx: anchor[0] + along * down[0] + lateral * perp[0],
        cy: anchor[1] + along * down[1] + lateral * perp[1],
        angle: baseAngle + rand(-PITCH_JITTER_DEG, PITCH_JITTER_DEG),
      });
    }
  });
  return placements;
}

function drawCover(ctx, img, W, H) {
  const s = Math.max(W / img.width, H / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// Additive glare blobs — applied after the warp so they read as bright specular
// highlights on top of the (possibly darkened) scene.
function addGlare(ctx, W, H) {
  const n = randint(GLARE_MIN, GLARE_MAX);
  const maxDim = Math.max(W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = rand(0, W);
    const y = rand(0, H);
    const r = rand(0.1, 0.45) * maxDim;
    const a = rand(GLARE_ALPHA[0], GLARE_ALPHA[1]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,248,${a})`);
    g.addColorStop(0.5, `rgba(255,255,248,${a * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,248,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// Bilinear RGBA sample from ImageData at (x, y), edge-clamped.
function sampleBilinear(data, W, H, x, y, out) {
  x = Math.max(0, Math.min(W - 1, x));
  y = Math.max(0, Math.min(H - 1, y));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let c = 0; c < 4; c++) {
    const a = data[(y0 * W + x0) * 4 + c];
    const b = data[(y0 * W + x1) * 4 + c];
    const d = data[(y1 * W + x0) * 4 + c];
    const e = data[(y1 * W + x1) * 4 + c];
    out[c] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy;
  }
}

// Warp the canvas through a keystone homography and bake in a global
// brightness/contrast shift. Returns the new canvas plus the forward map
// (composition coords → warped coords) for moving the GT quads.
function applyPerspective(canvas, W, H, brightness, contrast) {
  const ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, W, H);
  const dstFull = [[0, 0], [W, 0], [W, H], [0, H]];
  // Pull a slightly inset, jittered quad of the scene out to fill the frame.
  const ix = () => rand(0, PERSP_AMOUNT) * W;
  const iy = () => rand(0, PERSP_AMOUNT) * H;
  const srcQuad = [
    [ix(), iy()],
    [W - ix(), iy()],
    [W - ix(), H - iy()],
    [ix(), H - iy()],
  ];
  const sampleMap = computeHomography(dstFull, srcQuad); // dst px → src coord
  const fwd = computeHomography(srcQuad, dstFull); // comp coord → warped coord

  const out = createCanvas(W, H);
  const octx = out.getContext('2d');
  const odata = octx.createImageData(W, H);
  const px = new Float32Array(4);
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const [sx, sy] = applyH(sampleMap, [u, v]);
      sampleBilinear(src.data, W, H, sx, sy, px);
      const o = (v * W + u) * 4;
      for (let c = 0; c < 3; c++) {
        let val = (px[c] - 128) * contrast + 128;
        val *= brightness;
        odata.data[o + c] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
      odata.data[o + 3] = 255;
    }
  }
  octx.putImageData(odata, 0, 0);
  return { canvas: out, fwd };
}

// Draw `canvas` rotated by r∈{0,90,180,270}. Returns the rotated canvas and a
// point map (warped coords → final coords) consistent with the draw.
function applyRotation(canvas, W, H, r) {
  const swap = r === 90 || r === 270;
  const outW = swap ? H : W;
  const outH = swap ? W : H;
  const out = createCanvas(outW, outH);
  const ctx = out.getContext('2d');
  if (r === 90) {
    ctx.translate(H, 0);
    ctx.rotate(Math.PI / 2);
  } else if (r === 180) {
    ctx.translate(W, H);
    ctx.rotate(Math.PI);
  } else if (r === 270) {
    ctx.translate(0, W);
    ctx.rotate((3 * Math.PI) / 2);
  }
  ctx.drawImage(canvas, 0, 0);
  const mapPoint = ([x, y]) => {
    if (r === 90) return [H - y, x];
    if (r === 180) return [W - x, H - y];
    if (r === 270) return [y, W - x];
    return [x, y];
  };
  return { canvas: out, outW, outH, mapPoint };
}

// Render one image from a job ({ bgCard, cards: [record…] }) and write the
// image + annotation. Card images are resolved (lazy download/cache) here.
async function generateImage(job) {
  const [aw, ah] = choice(ASPECTS);
  const long = BASE_LONG_EDGE;
  const W = aw >= ah ? long : Math.round((long * aw) / ah);
  const H = aw >= ah ? Math.round((long * ah) / aw) : long;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background: a single random card's art crop (the only art crop we fetch).
  const artPath = await ensureArtImage(job.bgCard);
  let drew = false;
  if (artPath) {
    try {
      drawCover(ctx, await loadImage(artPath), W, H);
      drew = true;
    } catch {
      /* fall through to flat fill */
    }
  }
  if (!drew) {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, W, H);
  }

  // One shared draw-width per image (matches the real tool's shared scale).
  const cardW = rand(CARD_SCALE_MIN, CARD_SCALE_MAX) * W;

  // Resolve card images (lazy download/cache; full card image only); skip fails.
  const picks = [];
  for (const card of job.cards) {
    const cardPath = await ensureCardImage(card);
    if (!cardPath) continue;
    try {
      picks.push({ card, image: await loadImage(cardPath) });
    } catch {
      /* skip undecodable */
    }
  }

  const placements = buildLayout(picks.length, W, H, cardW, cardW * 1.4);
  const bodies = [];
  const labels = [];
  picks.forEach((p, i) => {
    const aspect = p.image.width / p.image.height; // true frame aspect
    const cw = cardW;
    const ch = cw / aspect;
    const { cx, cy, angle } = placements[i];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(deg2rad(angle));
    ctx.drawImage(p.image, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    bodies.push(placeQuad([[-cw / 2, -ch / 2], [cw / 2, -ch / 2], [cw / 2, ch / 2], [-cw / 2, ch / 2]], angle, cx, cy));
    // One card can contribute several name bars (split/room have two).
    for (const bar of nameBars(p.card, cw, ch)) {
      labels.push({ card: p.card, drawIndex: i, quad: placeQuad(bar, angle, cx, cy) });
    }
  });

  // Occlusion: keep a label only if enough of its area is uncovered by cards
  // drawn on top of it (later in draw order), sampled on a dense grid.
  const kept = [];
  labels.forEach((lab) => {
    let visible = 0;
    let total = 0;
    for (let ix = 0; ix < OCC_NX; ix++) {
      for (let iy = 0; iy < OCC_NY; iy++) {
        const p = quadPoint(lab.quad, (ix + 0.5) / OCC_NX, (iy + 0.5) / OCC_NY);
        total++;
        let covered = false;
        for (let j = lab.drawIndex + 1; j < bodies.length && !covered; j++) covered = pointInQuad(p, bodies[j]);
        if (!covered) visible++;
      }
    }
    if (visible / total >= VIS_THRESH) kept.push(lab);
  });

  // Perspective (+ brightness/contrast), glare, then whole-image rotation.
  const brightness = rand(BRIGHTNESS_RANGE[0], BRIGHTNESS_RANGE[1]);
  const contrast = rand(CONTRAST_RANGE[0], CONTRAST_RANGE[1]);
  const persp = applyPerspective(canvas, W, H, brightness, contrast);
  addGlare(persp.canvas.getContext('2d'), W, H);
  const r = choice([0, 90, 180, 270]);
  const rot = applyRotation(persp.canvas, W, H, r);

  // Carry GT quads through warp + rotation, normalize, and drop any whose name
  // bar ends up off the frame (centroid outside the image).
  const boxes = [];
  for (const lab of kept) {
    const quad = lab.quad
      .map((pt) => applyH(persp.fwd, pt))
      .map((pt) => rot.mapPoint(pt))
      .map(([x, y]) => [x / rot.outW, y / rot.outH]);
    const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4;
    const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4;
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) continue;
    boxes.push({ name: lab.card.name, scryfall_id: lab.card.id, lang: lab.card.lang, layout: lab.card.layout || 'normal', quad });
  }

  const id = crypto.randomUUID();
  const buf = await rot.canvas.encode('jpeg', JPEG_QUALITY);
  fs.writeFileSync(path.join(IMG_DIR, `${id}.jpg`), buf);
  fs.writeFileSync(
    path.join(ANN_DIR, `${id}.jpg.json`),
    JSON.stringify({
      image: `${id}.jpg`,
      width: rot.outW,
      height: rot.outH,
      synthetic: true,
      rotation: r,
      background: job.bgCard.id,
      boxes,
    }),
  );
  return { id, count: boxes.length };
}

// ---- worker thread: render jobs on demand ----------------------------------
if (!isMainThread) {
  parentPort.on('message', async (msg) => {
    if (msg.done) {
      process.exit(0);
    }
    try {
      const res = await generateImage(msg.job);
      parentPort.postMessage({ ok: true, ...res });
    } catch (e) {
      parentPort.postMessage({ ok: false, error: String(e?.stack || e) });
    }
  });
}

// ---- main thread: load index, dispatch jobs across workers -----------------
function runPool(jobs, numWorkers) {
  return new Promise((resolve) => {
    let next = 0;
    let done = 0;
    const workers = [];
    const dispatch = (w) => {
      if (next >= jobs.length) {
        w.postMessage({ done: true });
        return;
      }
      w.postMessage({ job: jobs[next++] });
    };
    for (let i = 0; i < numWorkers; i++) {
      const w = new Worker(new URL(import.meta.url));
      workers.push(w);
      w.on('message', (res) => {
        done++;
        if (res.ok) console.log(`  [${done}/${jobs.length}] ${res.id}.jpg — ${res.count} labels`);
        else console.warn(`  [${done}/${jobs.length}] failed: ${res.error?.split('\n')[0]}`);
        if (done >= jobs.length) {
          workers.forEach((x) => x.terminate());
          resolve();
        } else {
          dispatch(w);
        }
      });
      dispatch(w);
    }
  });
}

async function main() {
  if (!fs.existsSync(BULK_PATH)) {
    console.error('Missing bulk export. Run:  node scripts/download-bulk.mjs');
    process.exit(1);
  }
  fs.mkdirSync(IMG_DIR, { recursive: true });
  fs.mkdirSync(ANN_DIR, { recursive: true });

  const index = await loadCardIndex({ langFilter: LANG_FILTER });
  if (!index.length) throw new Error('no usable cards in index');

  // Pick cards up front (uniform over the index) so workers don't need it.
  const jobs = [];
  for (let i = 0; i < NUM_IMAGES; i++) {
    const n = randint(MIN_CARDS, MAX_CARDS);
    jobs.push({ bgCard: choice(index), cards: Array.from({ length: n }, () => choice(index)) });
  }

  const numWorkers = Math.max(1, Math.min(jobs.length, WORKERS || os.cpus().length - 1));
  console.log(`generating ${NUM_IMAGES} images across ${numWorkers} workers…`);
  const t = Date.now();
  await runPool(jobs, numWorkers);
  console.log(`done in ${((Date.now() - t) / 1000).toFixed(1)}s → ${IMG_DIR}`);
}

if (isMainThread) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
