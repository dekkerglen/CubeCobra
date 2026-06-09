import React, { useCallback, useEffect, useRef, useState } from 'react';

import SyntheticViewer from './SyntheticViewer';
import PredictViewer from './PredictViewer';

// An oriented name-bar box. cx/cy are the center normalized to [0,1] (cx by
// image width, cy by image height); angle is in degrees (always a multiple of 2),
// rotating the box clockwise on screen. The box size is not per-box — every box
// in an image shares the annotation's `scale` (see Annotation).
interface Box {
  cx: number;
  cy: number;
  angle: number;
}

interface Annotation {
  image: string;
  width: number;
  height: number;
  aspect: number;
  // Shared box width as a fraction of image width; height = scale / aspect.
  // Adjusting it resizes every box in the image. Persisted per image.
  scale: number;
  boxes: Box[];
}

const ASPECT = 25 / 2; // width : height of a card title bar (name + mana cost)
const ANGLE_STEP = 2; // angles snap to 2° increments
const DEG_PER_PX = 0.7; // vertical drag sensitivity → degrees
const MAX_DISPLAY_W = 1280; // cap the on-screen image width
const SCALE_MIN = 0.04;
const SCALE_MAX = 0.6;
const SCALE_STEP = 0.005; // per hotkey press / slider tick

const clampScale = (s: number): number => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

const clampSnap = (deg: number): number => {
  let a = Math.round(deg / ANGLE_STEP) * ANGLE_STEP;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
};

// Renders one box's region from the source image, deskewed upright (rotated by
// -angle), at the fixed 25:2 aspect — i.e. what the detector/OCR would see.
const BoxCrop: React.FC<{
  img: HTMLImageElement;
  dims: { w: number; h: number };
  box: Box;
  boxScale: number;
  height?: number;
}> = ({ img, dims, box, boxScale, height = 64 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || dims.w === 0) return;
    const targetW = Math.round(height * ASPECT);
    canvas.width = targetW;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, targetW, height);

    const cxPx = box.cx * dims.w;
    const cyPx = box.cy * dims.h;
    const wPx = boxScale * dims.w;
    const scale = targetW / Math.max(1, wPx);

    ctx.save();
    ctx.translate(targetW / 2, height / 2);
    ctx.rotate((-box.angle * Math.PI) / 180); // undo the box rotation → upright
    ctx.scale(scale, scale);
    ctx.drawImage(img, -cxPx, -cyPx); // place box center at canvas center
    ctx.restore();
  }, [img, dims, box, boxScale, height]);
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: 'auto', background: '#000', borderRadius: 3 }} />;
};

const App: React.FC = () => {
  const [mode, setMode] = useState<'annotate' | 'synthetic' | 'predict'>('annotate');
  if (mode === 'synthetic') return <SyntheticViewer onExit={() => setMode('annotate')} />;
  if (mode === 'predict') return <PredictViewer onExit={() => setMode('annotate')} />;
  return <Annotator onShowSynthetic={() => setMode('synthetic')} onShowPredict={() => setMode('predict')} />;
};

const Annotator: React.FC<{ onShowSynthetic: () => void; onShowPredict: () => void }> = ({ onShowSynthetic, onShowPredict }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startY: number; base: number } | null>(null);
  const lastAngleRef = useRef<number>(0);

  const [images, setImages] = useState<string[]>([]);
  const [imagesDir, setImagesDir] = useState<string>('');
  const [index, setIndex] = useState<number>(0);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [scale, setScale] = useState<number>(0.18); // box width as fraction of image width
  const [draft, setDraft] = useState<Box | null>(null);
  const [hover, setHover] = useState<{ cx: number; cy: number } | null>(null);
  const [hoveredBox, setHoveredBox] = useState<number | null>(null);

  const name = images[index];

  // Load the list of images once.
  useEffect(() => {
    fetch('/api/images')
      .then((r) => r.json())
      .then((d) => {
        setImages(d.images || []);
        setImagesDir(d.dir || '');
      })
      .catch(() => setImages([]));
  }, []);

  // Load the current image and its saved annotations whenever we navigate.
  useEffect(() => {
    if (!name) {
      setImg(null);
      setBoxes([]);
      return;
    }
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setDims({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.src = `/img/${encodeURIComponent(name)}`;

    fetch(`/api/annotations/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((a) => {
        setBoxes(Array.isArray(a.boxes) ? a.boxes : []);
        // Adopt this image's saved scale if it has one; otherwise keep the
        // current scale (handy — card size is usually consistent across a shoot).
        if (typeof a.scale === 'number' && a.scale > 0) setScale(a.scale);
      })
      .catch(() => setBoxes([]));
    lastAngleRef.current = 0;
  }, [name]);

  const save = useCallback(
    (nextBoxes: Box[], nextScale: number) => {
      if (!name) return;
      const annotation: Annotation = {
        image: name,
        width: dims.w,
        height: dims.h,
        aspect: ASPECT,
        scale: nextScale,
        boxes: nextBoxes,
      };
      fetch(`/api/annotations/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annotation),
      }).catch(() => {});
    },
    [name, dims.w, dims.h],
  );

  const commitBoxes = useCallback(
    (nextBoxes: Box[]) => {
      setBoxes(nextBoxes);
      save(nextBoxes, scale);
    },
    [save, scale],
  );

  // The scale slider resizes every box in the image; persist it with the boxes.
  const changeScale = useCallback(
    (nextScale: number) => {
      setScale(nextScale);
      save(boxes, nextScale);
    },
    [save, boxes],
  );

  // Draw the image, all committed boxes, the hover ghost, and the in-progress draft.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img || dims.w === 0) return;
    const W = Math.min(MAX_DISPLAY_W, dims.w);
    const H = (dims.h * W) / dims.w;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);

    const drawBox = (b: Box, color: string, dashed = false) => {
      const cx = b.cx * W;
      const cy = b.cy * H;
      const wPx = scale * W; // every box shares the annotation scale
      const hPx = wPx / ASPECT;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((b.angle * Math.PI) / 180);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.setLineDash(dashed ? [6, 4] : []);
      ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
      // "up" tick so the orientation is visible
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -hPx / 2 - 10);
      ctx.stroke();
      ctx.restore();
    };

    boxes.forEach((b, i) => drawBox(b, hoveredBox === i ? '#f59e0b' : '#22c55e'));
    if (hover && !draft) drawBox({ cx: hover.cx, cy: hover.cy, angle: lastAngleRef.current }, '#60a5fa', true);
    if (draft) drawBox(draft, '#f59e0b');
  }, [img, dims, boxes, draft, hover, scale, hoveredBox]);

  const toCanvas = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Topmost box (last drawn) hit by a point, or -1.
  const hitBox = (x: number, y: number): number => {
    const canvas = canvasRef.current!;
    const W = canvas.width;
    const H = canvas.height;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i]!;
      const dx = x - b.cx * W;
      const dy = y - b.cy * H;
      const a = (-b.angle * Math.PI) / 180;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      const wPx = scale * W;
      const hPx = wPx / ASPECT;
      if (Math.abs(lx) <= wPx / 2 && Math.abs(ly) <= hPx / 2) return i;
    }
    return -1;
  };

  const finishDraft = () => {
    if (dragRef.current && draft) {
      commitBoxes([...boxes, draft]);
      lastAngleRef.current = draft.angle;
    }
    dragRef.current = null;
    setDraft(null);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = toCanvas(e);
    const canvas = canvasRef.current!;
    // Right-click removes a box.
    if (e.button === 2) {
      const hit = hitBox(x, y);
      if (hit >= 0) commitBoxes(boxes.filter((_, i) => i !== hit));
      return;
    }
    if (e.button !== 0) return;
    // Left-click places the center; the initial angle carries over from the last
    // placed box so same-orientation cards are a single click each.
    dragRef.current = { startY: y, base: lastAngleRef.current };
    setDraft({ cx: x / canvas.width, cy: y / canvas.height, angle: lastAngleRef.current });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = toCanvas(e);
    const canvas = canvasRef.current!;
    if (dragRef.current) {
      const dy = dragRef.current.startY - y; // up = positive angle
      const angle = clampSnap(dragRef.current.base + dy * DEG_PER_PX);
      setDraft((d) => (d ? { ...d, angle } : d));
    } else {
      setHover({ cx: x / canvas.width, cy: y / canvas.height });
    }
  };

  // Keyboard: a/d (or arrows) navigate, z/backspace undo last box,
  // [ / - shrink and ] / + grow the shared box scale.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'a' || e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'd' || e.key === 'ArrowRight') {
        setIndex((i) => Math.min(images.length - 1, i + 1));
      } else if (e.key === 'z' || e.key === 'Backspace') {
        e.preventDefault();
        if (boxes.length > 0) commitBoxes(boxes.slice(0, -1));
      } else if (e.key === '[' || e.key === '-') {
        e.preventDefault();
        changeScale(clampScale(scale - SCALE_STEP));
      } else if (e.key === ']' || e.key === '=' || e.key === '+') {
        e.preventDefault();
        changeScale(clampScale(scale + SCALE_STEP));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, boxes, commitBoxes, changeScale, scale]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>Name-bar Annotator</strong>
        <button onClick={onShowSynthetic} title="Browse the generated synthetic dataset">
          Synthetic ▦
        </button>
        <button onClick={onShowPredict} title="Run the trained model in-browser on the test photos">
          Predict ◎
        </button>
        <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index <= 0}>
          ◀ Prev (a)
        </button>
        <span>
          {images.length ? `${index + 1} / ${images.length}` : 'no images'}
          {name ? ` — ${name}` : ''}
        </span>
        <button onClick={() => setIndex((i) => Math.min(images.length - 1, i + 1))} disabled={index >= images.length - 1}>
          Next (d) ▶
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Scale
          <input
            type="range"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={SCALE_STEP}
            value={scale}
            onChange={(e) => changeScale(parseFloat(e.target.value))}
            style={{ width: 200 }}
          />
          <span style={{ width: 44, textAlign: 'right' }}>{Math.round(scale * 100)}%</span>
        </label>
        <span style={{ opacity: 0.8 }}>boxes: {boxes.length}</span>
        <button onClick={() => commitBoxes([])} disabled={!boxes.length}>
          Clear (image)
        </button>
        <button onClick={() => boxes.length && commitBoxes(boxes.slice(0, -1))} disabled={!boxes.length}>
          Undo (z)
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
        Click to place a box center, then drag up/down to set its angle (snaps to 2°). Right-click a box to delete it.
        Scale slider (or <code>[</code>/<code>]</code>) sizes the boxes. {imagesDir ? <span>Images: {imagesDir}</span> : null}
      </div>

      {!images.length && (
        <div style={{ padding: 20, opacity: 0.8 }}>
          No images found. Drop photos into <code>packages/annotator/images</code> (or set{' '}
          <code>ANNOTATOR_IMAGES_DIR</code>) and reload.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'inline-block', border: '1px solid #444' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={finishDraft}
              onMouseLeave={() => {
                finishDraft();
                setHover(null);
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          {draft && <div style={{ marginTop: 6, fontSize: 13 }}>placing — angle {draft.angle}° (drag up/down)</div>}
        </div>

        {/* Crops of each captured box, with a remove button. */}
        <div
          style={{
            flex: '0 0 340px',
            maxHeight: '82vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.8 }}>Captures ({boxes.length})</div>
          {boxes.length === 0 && <div style={{ opacity: 0.6, fontSize: 13 }}>None yet.</div>}
          {img &&
            boxes.map((b, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoveredBox(i)}
                onMouseLeave={() => setHoveredBox(null)}
                style={{
                  border: '1px solid #444',
                  borderRadius: 4,
                  padding: 4,
                  background: hoveredBox === i ? '#3a3320' : '#222',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ opacity: 0.7 }}>
                    #{i + 1} · {b.angle}°
                  </span>
                  <button
                    onClick={() => commitBoxes(boxes.filter((_, j) => j !== i))}
                    title="Remove this box"
                    style={{ padding: '0 8px', lineHeight: '20px' }}
                  >
                    ✕
                  </button>
                </div>
                <BoxCrop img={img} dims={dims} box={b} boxScale={scale} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default App;
