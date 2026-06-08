// Client-side YOLO-OBB post-processing. Ports the pipeline validated in Python
// against the ONNX model: letterbox preprocess → decode the [1,6,N] output
// ([cx,cy,w,h,score,angle] per anchor, in input-px coords) → rotated NMS.

export interface Det {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number; // radians
  score: number;
}

export interface Prep {
  input: Float32Array; // NCHW RGB /255
  scale: number; // original→letterbox scale
  dw: number;
  dh: number; // letterbox padding
}

// Letterbox `img` into an imgsz×imgsz RGB tensor (gray pad), matching training.
export function preprocess(img: HTMLImageElement, imgsz: number): Prep {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const scale = Math.min(imgsz / W, imgsz / H);
  const nw = Math.round(W * scale);
  const nh = Math.round(H * scale);
  const dw = (imgsz - nw) / 2;
  const dh = (imgsz - nh) / 2;
  const c = document.createElement('canvas');
  c.width = imgsz;
  c.height = imgsz;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, imgsz, imgsz);
  ctx.drawImage(img, dw, dh, nw, nh);
  const { data } = ctx.getImageData(0, 0, imgsz, imgsz);
  const n = imgsz * imgsz;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = data[i * 4] / 255; // R plane
    input[n + i] = data[i * 4 + 1] / 255; // G plane
    input[2 * n + i] = data[i * 4 + 2] / 255; // B plane
  }
  return { input, scale, dw, dh };
}

// Decode the raw output tensor (data laid out as [6, N]) back to original-image
// coords, keeping anchors above `conf`.
export function decode(out: Float32Array, N: number, prep: Prep, conf: number): Det[] {
  const { scale, dw, dh } = prep;
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

// Four corners of an oriented box, in image px.
export function corners(d: Det): [number, number][] {
  const c = Math.cos(d.angle);
  const s = Math.sin(d.angle);
  const hw = d.w / 2;
  const hh = d.h / 2;
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as [number, number][]).map(
    ([dx, dy]) => [d.cx + dx * c - dy * s, d.cy + dx * s + dy * c],
  );
}

// ---- rotated IoU via Sutherland–Hodgman convex clipping --------------------
type Pt = [number, number];

function signedArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i][0] * p[j][1] - p[j][0] * p[i][1];
  }
  return a / 2;
}
function ccw(p: Pt[]): Pt[] {
  return signedArea(p) > 0 ? p : [...p].reverse();
}
function inside(P: Pt, A: Pt, B: Pt): boolean {
  return (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]) >= 0;
}
function isect(P1: Pt, P2: Pt, A: Pt, B: Pt): Pt {
  const a1 = B[1] - A[1];
  const b1 = A[0] - B[0];
  const c1 = a1 * A[0] + b1 * A[1];
  const a2 = P2[1] - P1[1];
  const b2 = P1[0] - P2[0];
  const c2 = a2 * P1[0] + b2 * P1[1];
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-12) return P2;
  return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
}
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

export function nms(dets: Det[], iou: number): Det[] {
  const sorted = [...dets].sort((x, y) => y.score - x.score);
  const keep: Det[] = [];
  while (sorted.length) {
    const best = sorted.shift()!;
    keep.push(best);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (riou(best, sorted[i]) >= iou) sorted.splice(i, 1);
    }
  }
  return keep;
}
