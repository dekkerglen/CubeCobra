import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

import DeskewCrop from './DeskewCrop';
import { corners, decode, Det, nms, preprocess, Prep } from './lib/obb';

// Runs the trained YOLO-OBB detector entirely client-side (onnxruntime-web) and
// overlays its oriented boxes on the real test photos — the deployment target is
// the browser, so this is the model running exactly where it'll ship. The conf
// slider re-decodes the cached raw output (no re-inference); a/d navigate.
const MODEL_URL = '/models/namebar.onnx';
const META_URL = '/models/namebar.json';
const MAX_DISPLAY_W = 1280;
const IOU = 0.45;

// onnxruntime-web wasm assets from the matching CDN; single-thread avoids the
// cross-origin-isolation (COOP/COEP) requirement of threaded wasm.
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.common}/dist/`;
ort.env.wasm.numThreads = 1;

interface Cache {
  img: HTMLImageElement;
  data: Float32Array;
  N: number;
  prep: Prep;
}

const PredictViewer: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const cacheRef = useRef<Cache | null>(null);
  const imgszRef = useRef<number>(1024);

  const [status, setStatus] = useState<string>('loading model…');
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [conf, setConf] = useState<number>(0.25);
  const [showGT, setShowGT] = useState<boolean>(false);
  const [gt, setGt] = useState<[number, number][][]>([]);
  const [dets, setDets] = useState<Det[]>([]);
  const [inferMs, setInferMs] = useState<number>(0);

  const name = images[index];

  // Load model + image list once.
  useEffect(() => {
    (async () => {
      try {
        const meta = await fetch(META_URL).then((r) => r.json()).catch(() => ({ imgsz: 1024 }));
        imgszRef.current = meta.imgsz || 1024;
        sessionRef.current = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
        const list = await fetch('/api/test/images').then((r) => r.json());
        setImages(list.images || []);
        setStatus('ready');
      } catch (e) {
        setStatus(`model load failed: ${String(e)}`);
      }
    })();
  }, []);

  // Run inference on the current image (and fetch its ground truth).
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || !name) return;
    let cancelled = false;
    setStatus('running…');
    const img = new Image();
    img.onload = async () => {
      const imgsz = imgszRef.current;
      const prep = preprocess(img, imgsz);
      const tensor = new ort.Tensor('float32', prep.input, [1, 3, imgsz, imgsz]);
      const t0 = performance.now();
      const out = await session.run({ [session.inputNames[0]]: tensor });
      const o = out[session.outputNames[0]];
      if (cancelled) return;
      const data = o.data as Float32Array;
      const N = o.dims[2] as number;
      cacheRef.current = { img, data, N, prep };
      setInferMs(performance.now() - t0);
      setStatus('ready');
      setDets(nms(decode(data, N, prep, conf), IOU));
    };
    img.src = `/img/${encodeURIComponent(name)}`;

    fetch(`/api/annotations/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((a) => setGt(realGtQuads(a)))
      .catch(() => setGt([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Confidence slider: re-decode from the cached raw output (no re-inference).
  useEffect(() => {
    const c = cacheRef.current;
    if (c) setDets(nms(decode(c.data, c.N, c.prep, conf), IOU));
  }, [conf]);

  // Draw image + predicted boxes (+ optional ground truth).
  useEffect(() => {
    const canvas = canvasRef.current;
    const c = cacheRef.current;
    if (!canvas || !c) return;
    const W = Math.min(MAX_DISPLAY_W, c.img.naturalWidth);
    const s = W / c.img.naturalWidth;
    const H = c.img.naturalHeight * s;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(c.img, 0, 0, W, H);

    if (showGT) {
      ctx.strokeStyle = '#60a5fa';
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 2;
      for (const q of gt) {
        ctx.beginPath();
        ctx.moveTo(q[0][0] * W, q[0][1] * H);
        for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0] * W, q[k][1] * H);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34,197,94,0.10)';
    ctx.lineWidth = 2;
    ctx.font = '12px monospace';
    for (const d of dets) {
      const pts = corners(d);
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (let k = 1; k < 4; k++) ctx.lineTo(pts[k][0] * s, pts[k][1] * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.fillText(d.score.toFixed(2), pts[0][0] * s + 2, pts[0][1] * s - 3);
      ctx.fillStyle = 'rgba(34,197,94,0.10)';
    }
  }, [dets, gt, showGT]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex((i) => Math.min(images.length - 1, i + 1)), [images.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'a' || e.key === 'ArrowLeft') prev();
      else if (e.key === 'd' || e.key === 'ArrowRight') next();
      else if (e.key === 'g') setShowGT((v) => !v);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [prev, next]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>Predictions (in-browser model)</strong>
        <button onClick={onExit}>← Back to annotating</button>
        <button onClick={prev} disabled={index <= 0}>
          ◀ Prev (a)
        </button>
        <span>{images.length ? `${index + 1} / ${images.length}` : '—'}</span>
        <button onClick={next} disabled={index >= images.length - 1}>
          Next (d) ▶
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          conf
          <input type="range" min={0.05} max={0.95} step={0.01} value={conf} onChange={(e) => setConf(parseFloat(e.target.value))} />
          <span style={{ width: 32 }}>{conf.toFixed(2)}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showGT} onChange={(e) => setShowGT(e.target.checked)} />
          ground truth (g)
        </label>
        <span style={{ opacity: 0.8 }}>
          {status} · {dets.length} boxes{inferMs ? ` · ${inferMs.toFixed(0)}ms` : ''}
        </span>
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
        Live YOLO-OBB inference via onnxruntime-web (WASM). Green = prediction, blue dashed = hand label.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'inline-block', border: '1px solid #444' }}>
          <canvas ref={canvasRef} />
        </div>

        {/* Deskewed crop of every detected bar — what would feed OCR next. */}
        {cacheRef.current?.img && (
          <div
            style={{
              flex: '0 0 320px',
              maxHeight: '82vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.8 }}>Captures ({dets.length})</div>
            {[...dets]
              .sort((a, b) => b.score - a.score)
              .map((d, i) => {
                const img = cacheRef.current!.img;
                const quad = corners(d).map(
                  ([x, y]) => [x / img.naturalWidth, y / img.naturalHeight] as [number, number],
                );
                return (
                  <div key={i} style={{ border: '1px solid #444', borderRadius: 4, padding: 4, background: '#222' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, marginBottom: 3, opacity: 0.7 }}>
                      {(d.score * 100).toFixed(0)}%
                    </div>
                    <DeskewCrop img={img} quad={quad} />
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

// Real hand labels are oriented rects (cx, cy, angle + shared scale); to quads
// normalized to [0,1], matching the export converter.
function realGtQuads(ann: any): [number, number][][] {
  const W = ann?.width;
  const H = ann?.height;
  const scale = ann?.scale;
  if (!W || !H || !scale || !Array.isArray(ann.boxes)) return [];
  const aspect = ann.aspect || 12.5;
  const wpx = scale * W;
  const hpx = wpx / aspect;
  const local: [number, number][] = [[-wpx / 2, -hpx / 2], [wpx / 2, -hpx / 2], [wpx / 2, hpx / 2], [-wpx / 2, hpx / 2]];
  return ann.boxes.map((b: any) => {
    const cx = b.cx * W;
    const cy = b.cy * H;
    const a = (b.angle * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return local.map(([lx, ly]) => [(cx + lx * c - ly * s) / W, (cy + lx * s + ly * c) / H] as [number, number]);
  });
}

export default PredictViewer;
