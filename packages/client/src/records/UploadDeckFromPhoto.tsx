import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import { bestMatch, normalizeForMatch, PreparedPool, preparePool } from '@utils/fuzzyCardMatch';

import { UncontrolledAlertProps } from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import { cubeCardNameMatches } from 'utils/cardAutocomplete';
import { getCard } from 'utils/cards/getCard';

interface UploadDeckFromPhotoProps {
  cube: Cube;
  setMainboardCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
}

interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface ScanRow {
  id: number;
  raw: string;
  name: string;
  score: number;
  include: boolean;
  notInCube: boolean; // matched against the full catalog, not the cube pool
  bbox: Bbox;
  rotation: number; // per-card rotation applied to the crop for display + re-OCR
  busy: boolean; // re-OCR in flight for this row
}

type Status = 'idle' | 'preview' | 'working' | 'review';

// Confidence below this is shown but left unchecked for the user to confirm.
const INCLUDE_THRESHOLD = 0.6;
// A cube match below this is re-checked against the full catalog — the photo may
// contain a card that has since been cut from the cube.
const RECHECK_THRESHOLD = 0.85;
// Lines whose best match (cube or full catalog) stays below this are dropped from
// the review list. Card names match a real card well; type lines and rules text
// (also OCR'd off the fully-visible front card of each stack) do not, so this is
// what keeps non-name text out of the list.
const DISPLAY_FLOOR = 0.5;
// Card names are short. Skip obviously-too-long lines before matching so rules
// text doesn't waste a catalog lookup (generous — the longest real names fit).
const MAX_NAME_WORDS = 7;
const MAX_NAME_CHARS = 45;
// Long-edge cap for the image actually fed to OCR. Phone photos are ~12MP, which
// is needlessly slow to recognize; downscaling keeps it responsive.
const SCAN_MAX_EDGE = 2600;
const PREVIEW_MAX_EDGE = 1000;

const confidenceColor = (score: number): string => {
  if (score >= 0.8) return 'text-green-600';
  if (score >= INCLUDE_THRESHOLD) return 'text-yellow-600';
  return 'text-red-600';
};

// Draw an image onto a canvas rotated by `deg` (0/90/180/270), downscaled so the
// longer edge is at most maxEdge. Returns the canvas; its width/height are the
// post-rotation pixel dimensions that bounding boxes will be expressed in.
const makeRotatedCanvas = (img: HTMLImageElement, deg: number, maxEdge: number): HTMLCanvasElement => {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const sw = Math.round(img.width * scale);
  const sh = Math.round(img.height * scale);
  const rotated = deg % 180 !== 0;

  const canvas = document.createElement('canvas');
  canvas.width = rotated ? sh : sw;
  canvas.height = rotated ? sw : sh;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  }
  return canvas;
};

// Card title bars are a consistent shape — a wide strip (~25:2) holding the name
// and, on the right, the mana cost. Expand a tight OCR text box into that fixed
// aspect so the overlay box and crop always frame the whole name bar (and mana
// cost), shifting as needed to stay inside the image so the ratio is preserved.
const NAME_BOX_ASPECT = 25 / 2;

const fixedAspectNameBox = (bbox: Bbox, imgW: number, imgH: number): Bbox => {
  const textH = Math.max(1, bbox.y1 - bbox.y0);
  let h = textH * 1.3;
  let w = h * NAME_BOX_ASPECT;
  if (w > imgW) {
    w = imgW;
    h = w / NAME_BOX_ASPECT;
  }
  const cy = (bbox.y0 + bbox.y1) / 2;
  let x0 = bbox.x0;
  let y0 = cy - h / 2;
  if (x0 + w > imgW) x0 = imgW - w;
  if (x0 < 0) x0 = 0;
  if (y0 + h > imgH) y0 = imgH - h;
  if (y0 < 0) y0 = 0;
  return { x0, y0, x1: x0 + w, y1: y0 + h };
};

// Draw the bbox region of `source`, rotated by `rotation` degrees, into `canvas`,
// scaled so the rendered height is `targetH`. Used both for the on-screen crop
// thumbnails and to produce a deskewed image for per-box re-OCR.
const drawRotatedCrop = (
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  bbox: Bbox,
  rotation: number,
  targetH: number,
): void => {
  const bw = Math.max(1, bbox.x1 - bbox.x0);
  const bh = Math.max(1, bbox.y1 - bbox.y0);
  const rotated = rotation % 180 !== 0;
  const dispW = rotated ? bh : bw;
  const dispH = rotated ? bw : bh;
  const scale = targetH / dispH;

  canvas.width = Math.max(1, Math.round(dispW * scale));
  canvas.height = Math.max(1, Math.round(dispH * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(source, bbox.x0, bbox.y0, bw, bh, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();
};

const RotatedCrop: React.FC<{
  source: HTMLCanvasElement | null;
  bbox: Bbox;
  rotation: number;
  targetH?: number;
  className?: string;
}> = ({ source, bbox, rotation, targetH = 30, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && source) {
      drawRotatedCrop(ref.current, source, bbox, rotation, targetH);
    }
  }, [source, bbox, rotation, targetH]);
  return <canvas ref={ref} className={className} />;
};

interface OcrWord {
  text: string;
  bbox: Bbox;
}

// Card-type / supertype words. A line made up ENTIRELY of these is a type line,
// not a name (e.g. "Artifact", "Legendary Creature"). Real names that merely
// contain one of these ("Artifact Mutation") keep their other word and survive,
// and basic lands (Forest/Island/…) aren't type words so they're unaffected.
const TYPE_WORDS = new Set([
  'legendary',
  'basic',
  'snow',
  'world',
  'creature',
  'instant',
  'sorcery',
  'artifact',
  'enchantment',
  'planeswalker',
  'land',
  'battle',
  'tribal',
  'kindred',
  'token',
  'emblem',
]);

const isTypeLineOnly = (text: string): boolean => {
  const words = normalizeForMatch(text).split(' ').filter(Boolean);
  return words.length > 0 && words.every((word) => TYPE_WORDS.has(word));
};

interface OcrLine {
  words: { text: string; x0: number; y0: number; x1: number; y1: number; yc: number; h: number }[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  yc: number;
  h: number;
}

// Reconstruct individual card-name lines from loose words. These photos are a
// grid of fanned stacks (several columns across, a couple of rows down), so a
// word joins a name only when it is BOTH on the same baseline (close y) AND
// horizontally adjacent (small x-gap) to that name's current right edge. A wide
// x-gap means the next column → a new name; the vertical offset between stacked
// cards keeps stacked names apart. Each name's box is the union of its words.
const clusterWordsIntoLines = (words: OcrWord[]): { text: string; bbox: Bbox }[] => {
  if (words.length === 0) {
    return [];
  }

  const items = words
    .map((w) => ({
      text: w.text,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
      yc: (w.bbox.y0 + w.bbox.y1) / 2,
      h: Math.max(1, w.bbox.y1 - w.bbox.y0),
    }))
    // Reading order: top-to-bottom, then left-to-right.
    .sort((a, b) => a.yc - b.yc || a.x0 - b.x0);

  const lines: OcrLine[] = [];

  for (const it of items) {
    let best: OcrLine | null = null;
    let bestGap = Infinity;

    for (const line of lines) {
      const scale = Math.max(line.h, it.h);
      // Same baseline?
      if (Math.abs(it.yc - line.yc) > scale * 0.6) {
        continue;
      }
      // Just to the right of this name's current end? (allow slight overlap)
      const gap = it.x0 - line.x1;
      if (gap > scale * 1.4 || gap < -scale * 1.5) {
        continue;
      }
      if (Math.abs(gap) < bestGap) {
        bestGap = Math.abs(gap);
        best = line;
      }
    }

    if (best) {
      best.words.push(it);
      best.x0 = Math.min(best.x0, it.x0);
      best.y0 = Math.min(best.y0, it.y0);
      best.x1 = Math.max(best.x1, it.x1);
      best.y1 = Math.max(best.y1, it.y1);
      best.yc = (best.y0 + best.y1) / 2;
      best.h = best.y1 - best.y0;
    } else {
      lines.push({ words: [it], x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, yc: it.yc, h: it.h });
    }
  }

  return lines.map((line) => ({
    text: [...line.words].sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' '),
    bbox: { x0: line.x0, y0: line.y0, x1: line.x1, y1: line.y1 },
  }));
};

const UploadDeckFromPhoto: React.FC<UploadDeckFromPhotoProps> = ({ cube, setMainboardCards, setAlerts }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const fileRef = useRef<HTMLInputElement>(null);
  const poolRef = useRef<PreparedPool[] | null>(null);
  const imageElRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  // The rotated source canvas the OCR ran on; kept so we can crop/re-OCR regions.
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Persistent single-line worker reused for per-box re-OCR.
  const ocrWorkerRef = useRef<any>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [rotation, setRotation] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [workingMessage, setWorkingMessage] = useState<string>('');
  const [scanSrc, setScanSrc] = useState<string | null>(null);
  const [scanDims, setScanDims] = useState<{ w: number; h: number } | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [adding, setAdding] = useState<boolean>(false);

  const loadPool = useCallback(async (): Promise<PreparedPool[]> => {
    if (poolRef.current) {
      return poolRef.current;
    }
    const response = await csrfFetch(`/cube/api/cubecardpool/${cube.id}?board=mainboard`, { method: 'GET' });
    const json = await response.json();
    const names: string[] = json?.success === 'true' ? json.names : [];
    const prepared = preparePool(names);
    poolRef.current = prepared;
    return prepared;
  }, [csrfFetch, cube.id]);

  // Fuzzy-match one OCR line against the FULL card catalog (server-side). Only
  // the text is sent, never the photo.
  const globalMatch = useCallback(
    async (raw: string): Promise<{ name: string; score: number } | null> => {
      try {
        const response = await csrfFetch(`/tool/api/cardnamematch?q=${encodeURIComponent(raw)}`, { method: 'GET' });
        const json = await response.json();
        return json?.success === 'true' ? json.match : null;
      } catch {
        return null;
      }
    },
    [csrfFetch],
  );

  const getOcrWorker = useCallback(async () => {
    if (ocrWorkerRef.current) {
      return ocrWorkerRef.current;
    }
    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('eng', 1);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    ocrWorkerRef.current = worker;
    return worker;
  }, []);

  const terminateWorker = useCallback(() => {
    if (ocrWorkerRef.current) {
      ocrWorkerRef.current.terminate?.();
      ocrWorkerRef.current = null;
    }
  }, []);

  const resetImage = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    imageElRef.current = null;
  }, []);

  const reset = useCallback(() => {
    resetImage();
    terminateWorker();
    scanCanvasRef.current = null;
    setRows([]);
    setScanSrc(null);
    setScanDims(null);
    setRotation(0);
    setHoveredId(null);
    setProgress(0);
    setStatus('idle');
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  }, [resetImage, terminateWorker]);

  // Terminate the re-OCR worker if the component unmounts mid-session.
  useEffect(() => () => terminateWorker(), [terminateWorker]);

  const onFileSelected = useCallback(
    (file: File) => {
      resetImage();
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      const img = new Image();
      img.onload = () => {
        imageElRef.current = img;
        setRotation(0);
        setStatus('preview');
      };
      img.onerror = () => {
        setAlerts((prev) => [...prev, { color: 'danger', message: 'Could not load that image.' }]);
        resetImage();
      };
      img.src = url;
    },
    [resetImage, setAlerts],
  );

  // Keep the preview canvas in sync with the current rotation.
  useEffect(() => {
    if (status !== 'preview') {
      return;
    }
    const img = imageElRef.current;
    const canvas = previewCanvasRef.current;
    if (!img || !canvas) {
      return;
    }
    const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(img.width, img.height));
    const sw = img.width * scale;
    const sh = img.height * scale;
    const rotated = rotation % 180 !== 0;
    canvas.width = Math.round(rotated ? sh : sw);
    canvas.height = Math.round(rotated ? sw : sh);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    }
  }, [status, rotation]);

  const matchText = useCallback(
    async (text: string): Promise<{ name: string; score: number; notInCube: boolean }> => {
      const pool = poolRef.current || [];
      const m = bestMatch(text, pool);
      let name = m?.name ?? '';
      let score = m?.score ?? 0;
      let notInCube = false;
      if (text && score < RECHECK_THRESHOLD) {
        const global = await globalMatch(text);
        if (global && global.score > score + 0.05) {
          notInCube = !m?.name || normalizeForMatch(global.name) !== normalizeForMatch(m.name);
          name = global.name;
          score = global.score;
        }
      }
      return { name, score, notInCube };
    },
    [globalMatch],
  );

  const updateRow = useCallback((id: number, patch: Partial<ScanRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const removeRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  // Rotate a single card's crop and re-read it. Handles cards laid at a different
  // orientation than the rest of the photo without a global rotation.
  const rotateRow = useCallback(
    async (row: ScanRow, delta: number) => {
      const src = scanCanvasRef.current;
      if (!src) {
        return;
      }
      const newRotation = (((row.rotation + delta) % 360) + 360) % 360;
      updateRow(row.id, { rotation: newRotation, busy: true });
      try {
        const crop = document.createElement('canvas');
        drawRotatedCrop(crop, src, row.bbox, newRotation, 64);
        const worker = await getOcrWorker();
        const { data } = await worker.recognize(crop);
        const text = (data.text || '').trim();
        const { name, score, notInCube } = await matchText(text);
        updateRow(row.id, {
          busy: false,
          raw: text || row.raw,
          name,
          score,
          include: score >= INCLUDE_THRESHOLD,
          notInCube,
        });
      } catch {
        updateRow(row.id, { busy: false });
      }
    },
    [getOcrWorker, matchText, updateRow],
  );

  const runScan = useCallback(async () => {
    const img = imageElRef.current;
    if (!img) {
      return;
    }

    const canvas = makeRotatedCanvas(img, rotation, SCAN_MAX_EDGE);
    scanCanvasRef.current = canvas;
    setScanSrc(canvas.toDataURL('image/jpeg', 0.92));
    setScanDims({ w: canvas.width, h: canvas.height });
    setStatus('working');
    setProgress(0);

    try {
      setWorkingMessage('Loading this cube’s card list…');
      const pool = await loadPool();
      if (pool.length === 0) {
        setAlerts((prev) => [...prev, { color: 'danger', message: 'This cube has no cards to match against.' }]);
        setStatus('preview');
        return;
      }

      setWorkingMessage('Reading the photo in your browser… (the image is never uploaded)');
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
          }
        },
      });
      // Fanned name bars are not a normal document layout: with the default page
      // segmentation Tesseract merges many names into a few giant "lines".
      // SPARSE_TEXT finds text anywhere on the page; we then rebuild per-name
      // rows ourselves from the individual word boxes.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      await worker.terminate();

      const words: OcrWord[] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const text = word.text.trim();
              if (text && word.confidence >= 40 && /[a-zA-Z]/.test(text)) {
                words.push({ text, bbox: word.bbox });
              }
            }
          }
        }
      }

      const lines = clusterWordsIntoLines(words).filter((line) => {
        const letters = (line.text.match(/[a-zA-Z]/g) || []).length;
        const wordCount = line.text.split(/\s+/).filter(Boolean).length;
        return (
          letters >= 3 &&
          wordCount <= MAX_NAME_WORDS &&
          line.text.length <= MAX_NAME_CHARS &&
          !isTypeLineOnly(line.text)
        );
      });

      const scanned: ScanRow[] = lines.map((line, index) => {
        const match = bestMatch(line.text, pool);
        return {
          id: index,
          raw: line.text,
          name: match?.name ?? '',
          score: match?.score ?? 0,
          include: (match?.score ?? 0) >= INCLUDE_THRESHOLD,
          notInCube: false,
          bbox: fixedAspectNameBox(line.bbox, canvas.width, canvas.height),
          rotation: 0,
          busy: false,
        };
      });

      const lowConfidence = scanned.some((row) => row.score < RECHECK_THRESHOLD);
      if (lowConfidence) {
        setWorkingMessage('Checking for cards no longer in the cube…');
      }
      const upgraded = await Promise.all(
        scanned.map(async (row) => {
          if (row.score >= RECHECK_THRESHOLD) {
            return row;
          }
          const global = await globalMatch(row.raw);
          if (global && global.score > row.score + 0.05) {
            const sameAsCube = !!row.name && normalizeForMatch(global.name) === normalizeForMatch(row.name);
            return {
              ...row,
              name: global.name,
              score: global.score,
              include: global.score >= INCLUDE_THRESHOLD,
              notInCube: !sameAsCube,
            };
          }
          return row;
        }),
      );

      // Keep only lines that plausibly resolved to a real card name; this is what
      // filters out the type lines and rules text captured off full card faces.
      setRows(upgraded.filter((row) => row.score >= DISPLAY_FLOOR));
      setStatus('review');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Photo scan failed', err);
      setAlerts((prev) => [...prev, { color: 'danger', message: 'Could not read that photo. Try a clearer image.' }]);
      setStatus('preview');
    }
  }, [rotation, loadPool, globalMatch, setAlerts]);

  const addToDeck = useCallback(async () => {
    const chosen = rows.filter((row) => row.include && row.name.trim());
    if (chosen.length === 0) {
      return;
    }

    setAdding(true);
    try {
      // Resolve each confirmed name to a card. Only the name string is sent —
      // never the photo. The cube's printing is chosen server-side by oracle id
      // at upload time, so defaultPrinting is just a sensible fallback.
      const resolved = await Promise.all(chosen.map((row) => getCard(csrfFetch, cube.defaultPrinting, row.name.trim())));
      const cards = resolved.filter((card): card is CardDetails => card !== null);
      const missed = chosen.length - cards.length;

      if (cards.length > 0) {
        setMainboardCards((prev) => [...prev, ...cards]);
      }
      setAlerts((prev) => [
        ...prev,
        {
          color: missed > 0 ? 'warning' : 'success',
          message:
            missed > 0
              ? `Added ${cards.length} card(s); ${missed} could not be resolved.`
              : `Added ${cards.length} card(s) to the mainboard.`,
        },
      ]);
      reset();
    } finally {
      setAdding(false);
    }
  }, [rows, csrfFetch, cube.defaultPrinting, setMainboardCards, setAlerts, reset]);

  const includedCount = rows.filter((row) => row.include && row.name.trim()).length;

  // Spotlight overlay for the hovered slice: four dark panels cover the whole
  // image EXCEPT the hovered box, leaving it bright with a thick ring. Built from
  // plain utility classes (no fragile arbitrary box-shadow) so it always renders.
  const hoveredRow = hoveredId !== null ? rows.find((row) => row.id === hoveredId) : undefined;
  const spotlight =
    hoveredRow && scanDims
      ? (() => {
          const L = (hoveredRow.bbox.x0 / scanDims.w) * 100;
          const T = (hoveredRow.bbox.y0 / scanDims.h) * 100;
          const W = ((hoveredRow.bbox.x1 - hoveredRow.bbox.x0) / scanDims.w) * 100;
          const H = ((hoveredRow.bbox.y1 - hoveredRow.bbox.y0) / scanDims.h) * 100;
          const dim = 'absolute bg-black/75 z-20 pointer-events-none';
          return (
            <>
              <div className={dim} style={{ left: 0, top: 0, width: '100%', height: `${T}%` }} />
              <div
                className={dim}
                style={{ left: 0, top: `${T + H}%`, width: '100%', height: `${Math.max(0, 100 - (T + H))}%` }}
              />
              <div className={dim} style={{ left: 0, top: `${T}%`, width: `${L}%`, height: `${H}%` }} />
              <div
                className={dim}
                style={{ left: `${L + W}%`, top: `${T}%`, width: `${Math.max(0, 100 - (L + W))}%`, height: `${H}%` }}
              />
              <div
                className="absolute z-30 rounded-sm ring-4 ring-yellow-300 pointer-events-none"
                style={{ left: `${L}%`, top: `${T}%`, width: `${W}%`, height: `${H}%` }}
              />
            </>
          );
        })()
      : null;

  return (
    <Flexbox direction="col" gap="2" className="border border-border rounded-md p-3">
      <Text semibold>Scan deck from photo (beta)</Text>
      <Text sm className="text-text-secondary">
        Use a photo where the cards are fanned so each card&apos;s name is visible. Recognition runs entirely in your
        browser — the photo is never uploaded.
      </Text>

      {status === 'idle' && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onFileSelected(file);
            }
          }}
        />
      )}

      {status === 'preview' && (
        <Flexbox direction="col" gap="2" alignItems="start">
          <Text sm>
            Rotate so most card names read left-to-right, then scan. You can fine-tune individual cards afterwards.
          </Text>
          {/* Controls above the image for easy reach. */}
          <Flexbox direction="row" gap="2" wrap="wrap">
            <Button color="secondary" onClick={() => setRotation((r) => (r + 270) % 360)}>
              <span className="text-nowrap">⟲ Rotate left</span>
            </Button>
            <Button color="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <span className="text-nowrap">⟳ Rotate right</span>
            </Button>
            <Button color="primary" onClick={runScan}>
              <span className="text-nowrap">Scan deck</span>
            </Button>
            <Button color="danger" onClick={reset}>
              <span className="text-nowrap">Discard</span>
            </Button>
          </Flexbox>
          <canvas ref={previewCanvasRef} className="max-w-full h-auto block rounded border border-border" />
        </Flexbox>
      )}

      {status === 'working' && (
        <Flexbox direction="row" gap="2" alignItems="center">
          <Spinner sm />
          <Text sm>
            {workingMessage}
            {progress > 0 ? ` ${Math.round(progress * 100)}%` : ''}
          </Text>
        </Flexbox>
      )}

      {status === 'review' && scanSrc && scanDims && (
        <Flexbox direction="col" gap="2">
          <Text sm semibold>
            Review matches ({includedCount} selected) — hover a card to spotlight it on the photo; rotate, correct, or
            uncheck any that are wrong.
          </Text>
          <div className="flex flex-row gap-3 items-start">
            {/* Left half: the scanned photo, pinned + capped to the viewport so it
                stays visible while the card list scrolls. overflow-hidden clips the
                hover "spotlight" shadow to the image. */}
            <div className="w-1/2 min-w-0 self-start sticky top-2">
              <div className="relative inline-block max-w-full align-top overflow-hidden rounded">
                <img src={scanSrc} alt="Scanned deck" className="block max-w-full max-h-[85vh] w-auto h-auto" />
                {/* Faint outline of every detected slice, hoverable to spotlight it. */}
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onMouseEnter={() => setHoveredId(row.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="absolute rounded-sm cursor-pointer ring-1 ring-sky-400/60 bg-sky-400/5 z-10 hover:ring-2 hover:ring-sky-400"
                    style={{
                      left: `${(row.bbox.x0 / scanDims.w) * 100}%`,
                      top: `${(row.bbox.y0 / scanDims.h) * 100}%`,
                      width: `${((row.bbox.x1 - row.bbox.x0) / scanDims.w) * 100}%`,
                      height: `${((row.bbox.y1 - row.bbox.y0) / scanDims.h) * 100}%`,
                    }}
                  />
                ))}
                {spotlight}
              </div>
            </div>

            {/* Right half: card list in its own viewport-height scroll container */}
            <div className="w-1/2 min-w-0 max-h-[85vh] overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {rows.length === 0 && (
                  <Text sm>No card names were detected. Try a clearer or more fanned photo.</Text>
                )}
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onMouseEnter={() => setHoveredId(row.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`flex flex-col gap-1 rounded border p-1 transition-colors ${
                      hoveredId === row.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-border'
                    }`}
                  >
                    {/* The actual name-bar pixels the OCR read, at this card's rotation. */}
                    <div className="flex flex-row items-center gap-2">
                      <RotatedCrop
                        source={scanCanvasRef.current}
                        bbox={row.bbox}
                        rotation={row.rotation}
                        targetH={28}
                        className="max-w-full h-auto block rounded bg-white border border-border"
                      />
                      {row.busy && <Spinner sm />}
                    </div>
                    <div className="flex flex-row items-center gap-1">
                      <Checkbox
                        label=""
                        checked={row.include}
                        setChecked={(value) => updateRow(row.id, { include: value })}
                      />
                      <button
                        type="button"
                        title="Rotate this card left"
                        disabled={row.busy}
                        onClick={() => rotateRow(row, 270)}
                        className="px-1 text-text-secondary hover:text-link disabled:opacity-50"
                      >
                        ⟲
                      </button>
                      <button
                        type="button"
                        title="Rotate this card right"
                        disabled={row.busy}
                        onClick={() => rotateRow(row, 90)}
                        className="px-1 text-text-secondary hover:text-link disabled:opacity-50"
                      >
                        ⟳
                      </button>
                      <div className="flex-1 min-w-0">
                        <AutocompleteInput
                          cubeId={cube.id}
                          getMatches={cubeCardNameMatches(cube.id, 'mainboard')}
                          type="text"
                          value={row.name}
                          setValue={(value) => updateRow(row.id, { name: value })}
                          placeholder="Card name"
                          autoComplete="off"
                          data-lpignore
                        />
                      </div>
                      <Text xs className={confidenceColor(row.score)}>
                        {Math.round(row.score * 100)}%
                      </Text>
                      {row.notInCube && (
                        <span
                          className="text-orange-600 text-xs text-nowrap"
                          title="Matched outside the cube — likely a card since removed"
                        >
                          not in cube
                        </span>
                      )}
                      <Button color="danger" onClick={() => removeRow(row.id)}>
                        <span className="text-nowrap">✕</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Flexbox direction="row" gap="2">
            <Button color="primary" block disabled={includedCount === 0 || adding} onClick={addToDeck}>
              {adding ? 'Adding…' : `Add ${includedCount} card(s) to mainboard`}
            </Button>
            <Button color="secondary" onClick={reset} disabled={adding}>
              <span className="text-nowrap">Discard</span>
            </Button>
          </Flexbox>
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default UploadDeckFromPhoto;
