import React, { useCallback, useEffect, useRef, useState } from 'react';

import DeskewCrop from './DeskewCrop';

// Read-only browser for the synthetic dataset: shows each generated photo with
// its ground-truth name-bar quads overlaid, so you can eyeball how realistic the
// generator's labels are. Labels are perspective-correct polygons (4 points),
// not the oriented-rectangle model used for hand annotation.
interface SynthBox {
  name: string;
  scryfall_id?: string;
  lang?: string;
  layout?: string;
  quad: [number, number][]; // 4 corners, normalized to [0,1]
}

interface SynthAnnotation {
  image: string;
  width: number;
  height: number;
  rotation?: number;
  boxes: SynthBox[];
}

const MAX_DISPLAY_W = 1280;

const SyntheticViewer: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<string[]>([]);
  const [dir, setDir] = useState<string>('');
  const [index, setIndex] = useState<number>(0);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [ann, setAnn] = useState<SynthAnnotation | null>(null);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  const name = images[index];

  useEffect(() => {
    fetch('/api/synthetic/images')
      .then((r) => r.json())
      .then((d) => {
        setImages(d.images || []);
        setDir(d.dir || '');
      })
      .catch(() => setImages([]));
  }, []);

  // Load the current synthetic image and its ground truth.
  useEffect(() => {
    if (!name) {
      setImg(null);
      setAnn(null);
      return;
    }
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = `/synthimg/${encodeURIComponent(name)}`;
    fetch(`/api/synthetic/annotations/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((a) => setAnn(a))
      .catch(() => setAnn(null));
  }, [name]);

  // Draw image + quad overlays.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const W = Math.min(MAX_DISPLAY_W, img.naturalWidth);
    const H = (img.naturalHeight * W) / img.naturalWidth;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    if (!showLabels || !ann) return;

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34,197,94,0.12)';
    for (const b of ann.boxes) {
      if (!b.quad || b.quad.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(b.quad[0][0] * W, b.quad[0][1] * H);
      for (let i = 1; i < 4; i++) ctx.lineTo(b.quad[i][0] * W, b.quad[i][1] * H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // little tick from the top edge midpoint so orientation is visible
      const mx = ((b.quad[0][0] + b.quad[1][0]) / 2) * W;
      const my = ((b.quad[0][1] + b.quad[1][1]) / 2) * H;
      const cx = (b.quad.reduce((s, p) => s + p[0], 0) / 4) * W;
      const cy = (b.quad.reduce((s, p) => s + p[1], 0) / 4) * H;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx + (mx - cx), my + (my - cy));
      ctx.stroke();
    }
  }, [img, ann, showLabels]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex((i) => Math.min(images.length - 1, i + 1)), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'a' || e.key === 'ArrowLeft') prev();
      else if (e.key === 'd' || e.key === 'ArrowRight') next();
      else if (e.key === 'l') setShowLabels((s) => !s);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>Synthetic Dataset</strong>
        <button onClick={onExit}>← Back to annotating</button>
        <button onClick={prev} disabled={index <= 0}>
          ◀ Prev (a)
        </button>
        <span>
          {images.length ? `${index + 1} / ${images.length}` : 'no synthetic images'}
          {name ? ` — ${name}` : ''}
          {ann?.rotation != null ? ` · rot ${ann.rotation}°` : ''}
        </span>
        <button onClick={next} disabled={index >= images.length - 1}>
          Next (d) ▶
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          Show labels (l)
        </label>
        <span style={{ opacity: 0.8 }}>labels: {ann?.boxes.length ?? 0}</span>
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
        Ground-truth name-bar quads from <code>scripts/generate-dataset.mjs</code>. Green polygons should sit on each
        visible card&apos;s name bar. {dir ? <span>Dir: {dir}</span> : null}
      </div>

      {!images.length && (
        <div style={{ padding: 20, opacity: 0.8 }}>
          No synthetic images yet. Run <code>node scripts/download-bulk.mjs</code> then{' '}
          <code>node scripts/generate-dataset.mjs</code>.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'inline-block', border: '1px solid #444' }}>
          <canvas ref={canvasRef} />
        </div>

        {/* Deskewed crop of every ground-truth name bar — the "card sub-images". */}
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
          <div style={{ fontSize: 13, opacity: 0.8 }}>Captures ({ann?.boxes.length ?? 0})</div>
          {img &&
            ann?.boxes.map((b, i) => (
              <div key={i} style={{ border: '1px solid #444', borderRadius: 4, padding: 4, background: '#222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{i + 1} · {b.name}
                  </span>
                  <span style={{ opacity: 0.6, flex: '0 0 auto', marginLeft: 6 }}>
                    {b.layout && b.layout !== 'normal' ? b.layout : b.lang}
                  </span>
                </div>
                <DeskewCrop img={img} quad={b.quad} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SyntheticViewer;
