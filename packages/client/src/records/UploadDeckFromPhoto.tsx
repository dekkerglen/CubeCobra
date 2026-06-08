import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import { bestMatch, normalizeForMatch, PreparedPool, preparePool } from '@utils/fuzzyCardMatch';

import { UncontrolledAlertProps } from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import Checkbox from 'components/base/Checkbox';
import { cubeThenAllCardNameMatches } from 'utils/cardAutocomplete';
import { getCard } from 'utils/cards/getCard';
import { detectNameBars } from 'utils/nameBarDetector';
import { loadCrossOriginImage } from 'utils/scanDeckImage';

// A candidate photo for a player (Hedron supplies several; deck preferred).
export interface DeckPhoto {
  type: 'pool' | 'deck';
  url: string;
}

interface UploadDeckFromPhotoProps {
  cube: Cube;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
  // Append-to-mainboard mode (single file upload), used by the deck-upload page.
  setMainboardCards?: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  // Deck mode (Hedron): preset photos to cycle through + a callback reporting the
  // current decklist (card names) and whether this (pool) photo should be turned
  // into a deck by the deckbuilder on submit. The review list IS the deck.
  photos?: DeckPhoto[];
  onCardsChange?: (cardNames: string[], autoBuild: boolean) => void;
  header?: React.ReactNode;
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
  notInCube: boolean; // matched against the full catalog, not the cube pool
  quad?: [number, number][]; // detector's oriented box (absent for manually-added cards)
  bbox?: Bbox; // axis-aligned bounds of `quad`, for the hover/spotlight overlay
}

type Status = 'idle' | 'preview' | 'working' | 'review';

// Confidence below this is shown but left unchecked for the user to confirm.
const INCLUDE_THRESHOLD = 0.6;
// A cube match below this is re-checked against the full catalog — the photo may
// contain a card that has since been cut from the cube.
const RECHECK_THRESHOLD = 0.85;
// Minimum detector confidence for a name-bar box to be shown for review.
const DETECT_CONF = 0.3;
// Long-edge cap for the scan image. Phone photos are ~12MP; downscaling keeps
// detection + per-crop OCR responsive (crops are still taken from this canvas).
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

// Axis-aligned bounds of an oriented box — used for the hover/spotlight overlay.
const quadAabb = (quad: [number, number][]): Bbox => {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

// Deskew an oriented quad from `source` into an upright crop canvas of height
// `targetH`. The quad's corner order encodes the text direction (0→1 along the
// text), so the affine that sends p0→(0,0), p1→(Wc,0), p3→(0,Hc) lands the name
// upright. Used for the row thumbnail and the per-crop OCR.
const deskewQuad = (source: CanvasImageSource, quad: [number, number][], targetH: number): HTMLCanvasElement => {
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
  ctx.setTransform(a, b, c, d, e, f); // canvas bounds clip the rest of the image
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
};

// Deskewed, upright thumbnail of one detected name bar.
const OrientedCrop: React.FC<{
  source: HTMLCanvasElement | null;
  quad: [number, number][];
  targetH?: number;
  className?: string;
}> = ({ source, quad, targetH = 30, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !source) return;
    const base = deskewQuad(source, quad, targetH);
    cv.width = base.width;
    cv.height = base.height;
    cv.getContext('2d')?.drawImage(base, 0, 0);
  }, [source, quad, targetH]);
  return <canvas ref={ref} className={className} />;
};

const UploadDeckFromPhoto: React.FC<UploadDeckFromPhotoProps> = ({
  cube,
  setMainboardCards,
  setAlerts,
  photos,
  onCardsChange,
  header,
}) => {
  const deckMode = !!photos;
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
  // Deck mode: which preset photo is selected (default to a deck photo), and
  // whether to approximate a deck from a pool photo.
  const [imageIndex, setImageIndex] = useState<number>(() => {
    if (!photos) return 0;
    const deckIdx = photos.findIndex((p) => p.type === 'deck');
    return deckIdx >= 0 ? deckIdx : 0;
  });
  const [autoBuildPool, setAutoBuildPool] = useState<boolean>(false);
  // Bumped whenever a new source image finishes loading, so the preview redraws
  // even when status/rotation are unchanged (e.g. cycling between photos).
  const [imageTick, setImageTick] = useState<number>(0);
  const currentPhoto = photos?.[imageIndex];

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
        setImageTick((t) => t + 1);
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
  }, [status, rotation, imageTick]);

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

  const addCard = useCallback(() => {
    setRows((prev) => {
      const nextId = prev.reduce((m, r) => Math.max(m, r.id), -1) + 1;
      return [...prev, { id: nextId, raw: '', name: '', score: 0, notInCube: false }];
    });
  }, []);

  // For a pool photo: checking this marks the validated pool to be run through the
  // deckbuilder when the whole record is submitted (so the heavy ML build happens
  // once, under a single progress bar, rather than inline per player).
  const toggleAutoBuild = useCallback((checked: boolean) => setAutoBuildPool(checked), []);

  // Deck mode: load the selected preset photo (cross-origin so we can read pixels
  // for detection). Re-runs when the player cycles to a different photo.
  useEffect(() => {
    if (!deckMode || !photos) return undefined;
    const photo = photos[imageIndex];
    if (!photo) return undefined;
    let cancelled = false;
    loadCrossOriginImage(photo.url)
      .then((img) => {
        if (cancelled) return;
        imageElRef.current = img;
        setRows([]);
        setRotation(0);
        setAutoBuildPool(false);
        setStatus('preview');
        setImageTick((t) => t + 1);
      })
      .catch(() => {
        if (!cancelled) setAlerts((prev) => [...prev, { color: 'danger', message: 'Could not load that photo.' }]);
      });
    return () => {
      cancelled = true;
    };
  }, [deckMode, photos, imageIndex, setAlerts]);

  // Deck mode: report the current decklist (named cards) and whether this pool
  // should be auto-built on submit, to the parent whenever either changes. Held
  // in a ref so an unmemoized callback can't loop.
  const onCardsChangeRef = useRef(onCardsChange);
  onCardsChangeRef.current = onCardsChange;
  const wantsAutoBuild = autoBuildPool && currentPhoto?.type === 'pool';
  useEffect(() => {
    if (deckMode && onCardsChangeRef.current) {
      onCardsChangeRef.current(
        rows.filter((row) => row.name.trim()).map((row) => row.name.trim()),
        wantsAutoBuild,
      );
    }
  }, [rows, deckMode, wantsAutoBuild]);

  const runScan = useCallback(async () => {
    const img = imageElRef.current;
    if (!img) {
      return;
    }
    setAutoBuildPool(false);

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

      // Detect the oriented name bars with the in-browser YOLO model, then OCR
      // each one's deskewed crop. This is far more robust on messy fanned piles
      // than reading the whole page and guessing which text is a name.
      setWorkingMessage('Finding card names in your browser… (the image is never uploaded)');
      const boxes = await detectNameBars(canvas, DETECT_CONF);
      if (boxes.length === 0) {
        setRows([]);
        setStatus('review');
        return;
      }

      setWorkingMessage(`Reading ${boxes.length} name bars…`);
      const worker = await getOcrWorker();
      const scanned: ScanRow[] = [];
      for (let i = 0; i < boxes.length; i++) {
        setProgress(i / boxes.length);
        const box = boxes[i];
        let text = '';
        try {
          const { data } = await worker.recognize(deskewQuad(canvas, box.quad, 64));
          text = (data.text || '').trim();
        } catch {
          // leave text empty — the row still shows the crop for manual entry
        }
        const { name, score, notInCube } = await matchText(text);
        scanned.push({
          id: i,
          raw: text,
          name,
          score,
          notInCube,
          quad: box.quad,
          bbox: quadAabb(box.quad),
        });
      }
      setProgress(1);
      setRows(scanned.sort((a, b) => b.score - a.score));
      setStatus('review');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Photo scan failed', err);
      setAlerts((prev) => [...prev, { color: 'danger', message: 'Could not read that photo. Try a clearer image.' }]);
      setStatus('preview');
    }
  }, [rotation, loadPool, getOcrWorker, matchText, setAlerts]);

  const addToDeck = useCallback(async () => {
    const named = rows.filter((row) => row.name.trim());
    if (named.length === 0) {
      return;
    }

    setAdding(true);
    try {
      // Resolve each name to a card. Only the name string is sent — never the
      // photo. The cube's printing is chosen server-side by oracle id at upload
      // time, so defaultPrinting is just a sensible fallback.
      const resolved = await Promise.all(
        named.map(async (row) => ({ row, card: await getCard(csrfFetch, cube.defaultPrinting, row.name.trim()) })),
      );
      const cards = resolved.map((r) => r.card).filter((card): card is CardDetails => card !== null);
      const failedIds = new Set(resolved.filter((r) => !r.card).map((r) => r.row.id));

      if (cards.length > 0) {
        setMainboardCards?.((prev) => [...prev, ...cards]);
      }

      if (failedIds.size === 0) {
        setAlerts((prev) => [
          ...prev,
          { color: 'success', message: `Added ${cards.length} card(s) to the mainboard.` },
        ]);
        reset();
      } else {
        // Partial success: keep the cards we resolved, but leave the rows that
        // couldn't be resolved (and any still-unnamed ones) up for fixing rather
        // than silently dropping them.
        setRows((prev) => prev.filter((row) => failedIds.has(row.id) || !row.name.trim()));
        setAlerts((prev) => [
          ...prev,
          {
            color: 'warning',
            message: `Added ${cards.length} card(s). ${failedIds.size} couldn't be resolved — fix or remove them below.`,
          },
        ]);
      }
    } finally {
      setAdding(false);
    }
  }, [rows, csrfFetch, cube.defaultPrinting, setMainboardCards, setAlerts, reset]);

  const addableCount = rows.filter((row) => row.name.trim()).length;

  // Spotlight overlay for the hovered slice: four dark panels cover the whole
  // image EXCEPT the hovered box, leaving it bright with a thick ring. Built from
  // plain utility classes (no fragile arbitrary box-shadow) so it always renders.
  const hoveredRow = hoveredId !== null ? rows.find((row) => row.id === hoveredId) : undefined;
  const spotlight =
    hoveredRow?.bbox && hoveredRow.quad && scanDims
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
              <svg
                viewBox={`0 0 ${scanDims.w} ${scanDims.h}`}
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full z-30 pointer-events-none"
              >
                <polygon
                  points={(hoveredRow.quad ?? []).map(([x, y]) => `${x},${y}`).join(' ')}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                  stroke="#fde047"
                  strokeWidth={3}
                />
              </svg>
            </>
          );
        })()
      : null;

  return (
    <Flexbox direction="col" gap="2" className="border border-border rounded-md p-3">
      {header}
      <Text semibold>Scan deck from photo</Text>
      <Text sm className="text-text-secondary">
        Recognition runs entirely in your browser — the photo is never uploaded.
      </Text>

      {status === 'idle' && !deckMode && (
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
      {status === 'idle' && deckMode && (
        <Flexbox direction="row" gap="2" alignItems="center">
          <Spinner sm />
          <Text sm>Loading photo…</Text>
        </Flexbox>
      )}

      {/* Preview + working share the SAME preview canvas so the image doesn't
          resize when scanning starts. */}
      {(status === 'preview' || status === 'working') && (
        <Flexbox direction="col" gap="2" alignItems="start">
          {status === 'preview' ? (
            <>
              <Text sm>
                Rotate so most card names read left-to-right, then scan. You can fine-tune individual cards afterwards.
              </Text>
              {/* Controls above the image for easy reach. */}
              <Flexbox direction="row" gap="2" wrap="wrap" alignItems="center">
                {deckMode && photos && photos.length > 1 && (
                  <>
                    <Button
                      color="secondary"
                      aria-label="Previous photo"
                      onClick={() => setImageIndex((i) => (i + photos.length - 1) % photos.length)}
                    >
                      <ChevronLeftIcon size={16} />
                    </Button>
                    <Button
                      color="secondary"
                      aria-label="Next photo"
                      onClick={() => setImageIndex((i) => (i + 1) % photos.length)}
                    >
                      <ChevronRightIcon size={16} />
                    </Button>
                  </>
                )}
                {currentPhoto && (
                  <Text sm className="text-text-secondary text-nowrap">
                    {currentPhoto.type === 'deck' ? 'Deck photo' : 'Pool photo'}
                    {photos && photos.length > 1 ? ` (${imageIndex + 1}/${photos.length})` : ''}
                  </Text>
                )}
                <Button color="secondary" onClick={() => setRotation((r) => (r + 270) % 360)}>
                  <span className="text-nowrap">⟲ Rotate left</span>
                </Button>
                <Button color="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
                  <span className="text-nowrap">⟳ Rotate right</span>
                </Button>
                <Button color="primary" onClick={runScan}>
                  <span className="text-nowrap">Scan deck</span>
                </Button>
                {!deckMode && (
                  <Button color="danger" onClick={reset}>
                    <span className="text-nowrap">Discard</span>
                  </Button>
                )}
              </Flexbox>
            </>
          ) : (
            <Flexbox direction="row" gap="2" alignItems="center">
              <Spinner sm />
              <Text sm>
                {workingMessage}
                {progress > 0 ? ` ${Math.round(progress * 100)}%` : ''}
              </Text>
            </Flexbox>
          )}
          <canvas ref={previewCanvasRef} className="max-w-full h-auto block rounded border border-border" />
        </Flexbox>
      )}

      {status === 'review' && scanSrc && scanDims && (
        <Flexbox direction="col" gap="2">
          <Text sm semibold>
            Review matches ({addableCount}) — hover a card to spotlight it on the photo; correct or discard any that are
            wrong.
          </Text>
          {/* Stacks vertically on mobile; photo beside the list from md up. */}
          <div className="flex flex-col md:flex-row gap-3 items-start">
            {/* The scanned photo, pinned + capped to the viewport (from md up) so it
                stays visible while the card list scrolls. overflow-hidden clips the
                hover "spotlight" shadow to the image. */}
            <div className="w-full md:w-1/2 min-w-0 self-start md:sticky md:top-2">
              <div className="relative inline-block max-w-full align-top overflow-hidden rounded">
                <img src={scanSrc} alt="Scanned deck" className="block max-w-full max-h-[85vh] w-auto h-auto" />
                {/* Oriented outline of every detected name bar, hoverable to spotlight it. */}
                <svg
                  viewBox={`0 0 ${scanDims.w} ${scanDims.h}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full z-10 pointer-events-none"
                >
                  {rows
                    .filter((row) => row.quad)
                    .map((row) => (
                      <polygon
                        key={row.id}
                        points={(row.quad ?? []).map(([x, y]) => `${x},${y}`).join(' ')}
                        onMouseEnter={() => setHoveredId(row.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: 'all', cursor: 'pointer' }}
                        fill={hoveredId === row.id ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.06)'}
                        stroke={hoveredId === row.id ? '#38bdf8' : 'rgba(56,189,248,0.6)'}
                        strokeWidth={hoveredId === row.id ? 2 : 1}
                      />
                    ))}
                </svg>
                {spotlight}
              </div>
            </div>

            {/* Card list; its own viewport-height scroll container from md up. */}
            <div className="w-full md:w-1/2 min-w-0 md:max-h-[85vh] md:overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {rows.length === 0 && (
                  <Text sm>No card names were detected. Try a clearer or more fanned photo.</Text>
                )}
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onMouseEnter={() => setHoveredId(row.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`flex flex-row items-center gap-2 rounded border p-1 transition-colors ${
                      hoveredId === row.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-border'
                    }`}
                  >
                    {/* The name-bar pixels the OCR read (absent for manually-added cards). */}
                    {row.quad ? (
                      <OrientedCrop
                        source={scanCanvasRef.current}
                        quad={row.quad}
                        targetH={28}
                        className="h-7 w-auto block rounded bg-white border border-border shrink-0"
                      />
                    ) : (
                      <div className="h-7 w-10 rounded bg-bg-active border border-border shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <AutocompleteInput
                        cubeId={cube.id}
                        getMatches={cubeThenAllCardNameMatches(cube.id, 'mainboard')}
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
                ))}
                <Button color="accent" onClick={addCard}>
                  <span className="text-nowrap">+ Add card</span>
                </Button>
              </div>
            </div>
          </div>

          {deckMode ? (
            <Flexbox direction="col" gap="2">
              {currentPhoto?.type === 'pool' && (
                <Checkbox
                  label="Auto-build this pool into a deck on submit (approximate)"
                  checked={autoBuildPool}
                  setChecked={toggleAutoBuild}
                />
              )}
              <Button color="secondary" onClick={() => setStatus('preview')}>
                <span className="text-nowrap">↺ Pick a different photo / re-scan</span>
              </Button>
            </Flexbox>
          ) : (
            <Flexbox direction="row" gap="2">
              <Button color="primary" block disabled={addableCount === 0 || adding} onClick={addToDeck}>
                {adding ? 'Adding…' : `Add ${addableCount} card(s) to mainboard`}
              </Button>
              <Button color="secondary" onClick={reset} disabled={adding}>
                <span className="text-nowrap">Discard</span>
              </Button>
            </Flexbox>
          )}
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default UploadDeckFromPhoto;
