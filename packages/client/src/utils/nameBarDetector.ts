// Client-side oriented name-bar detector (YOLO-OBB). Runs the model trained in
// packages/annotator entirely in the browser via onnxruntime-web — the photo is
// never uploaded. The model ships from packages/server/public/models and is
// fetched through cdnUrl (CloudFront in prod, same-origin in dev).
//
// onnxruntime-web is dynamically imported (like tesseract.js) so it stays out of
// the main bundle and only loads when someone scans a photo.

import { cdnUrl } from '@utils/cdnUrl';

export interface OrientedBox {
  quad: [number, number][]; // 4 corners in source-image px; 0→1 = long/text axis
  score: number;
}

interface Det {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  score: number;
}

const IMGSZ = 1024; // the model's fixed input size
const IOU = 0.45;

let sessionPromise: Promise<{ ort: any; session: any }> | null = null;

async function loadSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web');
      // WASM runtime from the matching jsdelivr build; single-thread avoids the
      // cross-origin-isolation (COOP/COEP) requirement of threaded wasm.
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.common}/dist/`;
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(cdnUrl('/models/namebar.onnx'), {
        executionProviders: ['wasm'],
      });
      return { ort, session };
    })();
  }
  return sessionPromise;
}

// Letterbox a canvas into an IMGSZ×IMGSZ RGB tensor (gray pad), matching training.
function preprocess(source: HTMLCanvasElement) {
  const W = source.width;
  const H = source.height;
  const scale = Math.min(IMGSZ / W, IMGSZ / H);
  const nw = Math.round(W * scale);
  const nh = Math.round(H * scale);
  const dw = (IMGSZ - nw) / 2;
  const dh = (IMGSZ - nh) / 2;
  const c = document.createElement('canvas');
  c.width = IMGSZ;
  c.height = IMGSZ;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, IMGSZ, IMGSZ);
  ctx.drawImage(source, 0, 0, W, H, dw, dh, nw, nh);
  const { data } = ctx.getImageData(0, 0, IMGSZ, IMGSZ);
  const n = IMGSZ * IMGSZ;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = data[i * 4] / 255;
    input[n + i] = data[i * 4 + 1] / 255;
    input[2 * n + i] = data[i * 4 + 2] / 255;
  }
  return { input, scale, dw, dh };
}

function decode(out: Float32Array, N: number, scale: number, dw: number, dh: number, conf: number): Det[] {
  const dets: Det[] = [];
  for (let i = 0; i < N; i++) {
    const score = out[4 * N + i];
    if (score < conf) continue;
    dets.push({
      cx: (out[i] - dw) / scale,
      cy: (out[N + i] - dh) / scale,
      w: out[2 * N + i] / scale,
      h: out[3 * N + i] / scale,
      angle: out[5 * N + i],
      score,
    });
  }
  return dets;
}

function corners(d: Det): [number, number][] {
  const c = Math.cos(d.angle);
  const s = Math.sin(d.angle);
  const hw = d.w / 2;
  const hh = d.h / 2;
  return (
    [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as [number, number][]
  ).map(([dx, dy]) => [d.cx + dx * c - dy * s, d.cy + dx * s + dy * c]);
}

// Deskew an oriented quad from `source` into an upright crop canvas of height
// `targetH`. Corner order encodes text direction (0→1 along the text), so the
// affine sending p0→(0,0), p1→(Wc,0), p3→(0,Hc) lands the name upright.
export function deskewQuad(source: CanvasImageSource, quad: [number, number][], targetH: number): HTMLCanvasElement {
  const p = quad;
  const ux = p[1][0] - p[0][0];
  const uy = p[1][1] - p[0][1];
  const wx = p[3][0] - p[0][0];
  const wy = p[3][1] - p[0][1];
  const len = Math.hypot(ux, uy);
  const thick = Math.hypot(wx, wy) || 1;
  const Hc = Math.max(1, Math.round(targetH));
  const Wc = Math.max(8, Math.round((Hc * len) / thick));
  const canvas = document.createElement('canvas');
  canvas.width = Wc;
  canvas.height = Hc;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const det = ux * wy - uy * wx || 1e-6;
  const a = (Wc * wy) / det;
  const c = (-Wc * wx) / det;
  const b = (-Hc * uy) / det;
  const d = (Hc * ux) / det;
  const e = -(a * p[0][0] + c * p[0][1]);
  const f = -(b * p[0][0] + d * p[0][1]);
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

// --- rotated IoU via Sutherland–Hodgman convex clipping ---------------------
type Pt = [number, number];
const signedArea = (p: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i][0] * p[j][1] - p[j][0] * p[i][1];
  }
  return a / 2;
};
const ccw = (p: Pt[]): Pt[] => (signedArea(p) > 0 ? p : [...p].reverse());
const inside = (P: Pt, A: Pt, B: Pt): boolean => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]) >= 0;
const isect = (P1: Pt, P2: Pt, A: Pt, B: Pt): Pt => {
  const a1 = B[1] - A[1];
  const b1 = A[0] - B[0];
  const c1 = a1 * A[0] + b1 * A[1];
  const a2 = P2[1] - P1[1];
  const b2 = P1[0] - P2[0];
  const c2 = a2 * P1[0] + b2 * P1[1];
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return P2;
  return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
};
function clip(subj: Pt[], cl: Pt[]): Pt[] {
  const c = ccw(cl);
  let out = subj;
  for (let i = 0; i < c.length; i++) {
    const A = c[i];
    const B = c[(i + 1) % c.length];
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const cur = inp[j];
      const prv = inp[(j - 1 + inp.length) % inp.length];
      const ic = inside(cur, A, B);
      const ip = inside(prv, A, B);
      if (ic) {
        if (!ip) out.push(isect(prv, cur, A, B));
        out.push(cur);
      } else if (ip) {
        out.push(isect(prv, cur, A, B));
      }
    }
    if (out.length === 0) return [];
  }
  return out;
}
function riou(a: Det, b: Det): number {
  const poly = clip(corners(a), corners(b));
  if (poly.length === 0) return 0;
  const inter = Math.abs(signedArea(poly));
  return inter > 0 ? inter / (a.w * a.h + b.w * b.h - inter) : 0;
}
function nms(dets: Det[]): Det[] {
  const sorted = [...dets].sort((x, y) => y.score - x.score);
  const keep: Det[] = [];
  while (sorted.length) {
    const best = sorted.shift()!;
    keep.push(best);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (riou(best, sorted[i]) >= IOU) sorted.splice(i, 1);
    }
  }
  return keep;
}

// Detect oriented name bars in a canvas. Returns boxes in the canvas's pixel
// coords, sorted by score. Loads the model on first call (cached thereafter).
export async function detectNameBars(source: HTMLCanvasElement, conf = 0.3): Promise<OrientedBox[]> {
  const { ort, session } = await loadSession();
  const prep = preprocess(source);
  const tensor = new ort.Tensor('float32', prep.input, [1, 3, IMGSZ, IMGSZ]);
  const result = await session.run({ [session.inputNames[0]]: tensor });
  const o = result[session.outputNames[0]];
  const dets = nms(decode(o.data as Float32Array, o.dims[2] as number, prep.scale, prep.dw, prep.dh, conf));
  return dets.sort((a, b) => b.score - a.score).map((d) => ({ quad: corners(d), score: d.score }));
}
