import React, { useCallback, useEffect, useRef, useState } from 'react';

// An oriented name-bar box. cx/cy are the center normalized to [0,1] (cx by
// image width, cy by image height); w is the box width as a fraction of image
// width; the height is derived from the fixed 25:2 aspect; angle is in degrees
// (always a multiple of 10), rotating the box clockwise on screen.
interface Box {
  cx: number;
  cy: number;
  w: number;
  angle: number;
}

interface Annotation {
  image: string;
  width: number;
  height: number;
  aspect: number;
  boxes: Box[];
}

const ASPECT = 25 / 2; // width : height of a card title bar (name + mana cost)
const ANGLE_STEP = 10; // angles snap to 10° increments
const DEG_PER_PX = 0.7; // vertical drag sensitivity → degrees
const MAX_DISPLAY_W = 1280; // cap the on-screen image width

const clampSnap = (deg: number): number => {
  let a = Math.round(deg / ANGLE_STEP) * ANGLE_STEP;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
};

const App: React.FC = () => {
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
      .then((a) => setBoxes(Array.isArray(a.boxes) ? a.boxes : []))
      .catch(() => setBoxes([]));
    lastAngleRef.current = 0;
  }, [name]);

  const save = useCallback(
    (nextBoxes: Box[]) => {
      if (!name) return;
      const annotation: Annotation = { image: name, width: dims.w, height: dims.h, aspect: ASPECT, boxes: nextBoxes };
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
      save(nextBoxes);
    },
    [save],
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
      const wPx = b.w * W;
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

    for (const b of boxes) drawBox(b, '#22c55e');
    if (hover && !draft) drawBox({ cx: hover.cx, cy: hover.cy, w: scale, angle: lastAngleRef.current }, '#60a5fa', true);
    if (draft) drawBox(draft, '#f59e0b');
  }, [img, dims, boxes, draft, hover, scale]);

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
      const wPx = b.w * W;
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
    setDraft({ cx: x / canvas.width, cy: y / canvas.height, w: scale, angle: lastAngleRef.current });
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

  // Keyboard: a/d (or arrows) navigate, z/backspace undo last box.
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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, boxes, commitBoxes]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>Name-bar Annotator</strong>
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
            min={0.04}
            max={0.6}
            step={0.005}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
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
        Click to place a box center, then drag up/down to set its angle (snaps to 10°). Right-click a box to delete it.
        Scale slider sizes new boxes. {imagesDir ? <span>Images: {imagesDir}</span> : null}
      </div>

      {!images.length && (
        <div style={{ padding: 20, opacity: 0.8 }}>
          No images found. Drop photos into <code>packages/annotator/images</code> (or set{' '}
          <code>ANNOTATOR_IMAGES_DIR</code>) and reload.
        </div>
      )}

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
  );
};

export default App;
