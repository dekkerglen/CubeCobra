// Detect + OCR the name bars in one deck photo, fully in the browser. Returns
// the raw OCR'd text of each detected bar (caller fuzzy-matches to card names).
// Shared by the photo-upload page and the Hedron auto-annotation flow.

import { deskewQuad, detectNameBars } from './nameBarDetector';

const SCAN_MAX_EDGE = 2600; // detection/OCR work canvas cap
const DETECT_CONF = 0.3;

export async function scanDeckImage(img: HTMLImageElement, ocrWorker: any): Promise<string[]> {
  const scale = Math.min(1, SCAN_MAX_EDGE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const boxes = await detectNameBars(canvas, DETECT_CONF);
  const texts: string[] = [];
  for (const box of boxes) {
    try {
      const { data } = await ocrWorker.recognize(deskewQuad(canvas, box.quad, 64));
      const text = (data.text || '').trim();
      if (text) texts.push(text);
    } catch {
      // skip an unreadable crop
    }
  }
  return texts;
}

// Load an image (cross-origin enabled so its pixels are readable for detection).
export function loadCrossOriginImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}
