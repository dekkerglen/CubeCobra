import React, { useEffect, useRef } from 'react';

// Deskews one oriented name-bar quad to an upright crop. The quad's corner order
// encodes the text direction (0→1 = along the text, 0→3 = across it), so an
// affine that sends p0→(0,0), p1→(Wc,0), p3→(0,Hc) lands the name upright
// regardless of the card's rotation. Perspective across a thin bar is negligible,
// so an affine (ignoring p2) is plenty. Used by both the Synthetic and Predict
// captures panels.
const DeskewCrop: React.FC<{ img: HTMLImageElement; quad: [number, number][]; height?: number }> = ({
  img,
  quad,
  height = 34,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !img || !quad || quad.length < 4) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const p = quad.map(([nx, ny]) => [nx * natW, ny * natH]);
    const ux = p[1][0] - p[0][0];
    const uy = p[1][1] - p[0][1];
    const wx = p[3][0] - p[0][0];
    const wy = p[3][1] - p[0][1];
    const len = Math.hypot(ux, uy);
    const thick = Math.hypot(wx, wy) || 1;
    const scale = 2; // supersample for crispness
    const Hc = Math.round(height * scale);
    const Wc = Math.max(8, Math.round((Hc * len) / thick));
    cv.width = Wc;
    cv.height = Hc;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const det = ux * wy - uy * wx || 1e-6;
    const a = (Wc * wy) / det;
    const c = (-Wc * wx) / det;
    const b = (-Hc * uy) / det;
    const d = (Hc * ux) / det;
    const e = -(a * p[0][0] + c * p[0][1]);
    const f = -(b * p[0][0] + d * p[0][1]);
    ctx.setTransform(a, b, c, d, e, f); // canvas bounds clip the rest of the image
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [img, quad, height]);
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: 'auto', background: '#000', borderRadius: 3 }} />;
};

export default DeskewCrop;
