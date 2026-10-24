import Card from '@utils/datatypes/Card';
import sharp from 'sharp';

import { safeFetch } from './safeFetch';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

// Tile sources are user-editable (a card's imgUrl), so every fetch is bounded: SSRF-safe,
// size- and time-capped, and only ordinary raster formats reach sharp. The number of tiles per
// image is capped too, since a custom format can request an arbitrarily large pack.
export const MAX_PACK_IMAGE_TILES = 30;
const MAX_TILE_BYTES = 5 * 1024 * 1024;
const TILE_FETCH_TIMEOUT_MS = 5000;
const TILE_MAX_REDIRECTS = 3;
const MAX_TILE_PIXELS = 25_000_000;
const ALLOWED_TILE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);
// Tiles fetched and decoded at once, so one pack can't hold dozens of decoded images in memory.
const TILE_CONCURRENCY = 6;

// Optimal dimensions for common pack sizes [width, height]
const PACK_DIMENSIONS: Record<number, [number, number]> = {
  1: [1, 1],
  2: [2, 1],
  3: [3, 1],
  4: [2, 2],
  5: [5, 1],
  6: [3, 2],
  7: [4, 2],
  8: [4, 2],
  9: [3, 3],
  10: [5, 2],
  11: [6, 2],
  12: [4, 3],
  13: [5, 3],
  14: [5, 3],
  15: [5, 3],
  16: [4, 4],
  17: [6, 3],
  18: [6, 3],
  19: [5, 4],
  20: [5, 4],
  21: [7, 3],
  22: [6, 4],
  23: [6, 4],
  24: [6, 4],
  25: [5, 5],
};

export const generatePackImage = async (fullPack: Card[]): Promise<Buffer> => {
  const pack = fullPack.slice(0, MAX_PACK_IMAGE_TILES);
  let width: number;
  let height: number;

  const dimensions = PACK_DIMENSIONS[pack.length];
  if (dimensions) {
    [width, height] = dimensions;
  } else {
    // Fallback calculation for unusual pack sizes
    width = Math.floor(Math.sqrt((5 / 3) * pack.length));
    height = Math.ceil(pack.length / width);
  }

  const sources = pack.map((card, index) => {
    const x = (index % width) * CARD_WIDTH;
    const y = Math.floor(index / width) * CARD_HEIGHT;
    return {
      src: card.imgUrl || card.details?.image_normal || card.details?.image_small || '',
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
  });

  return generateSamplepackImage(sources, width * CARD_WIDTH, height * CARD_HEIGHT);
};

// Scryfall (and other well-behaved hosts) now reject requests that send a
// default HTTP-library User-Agent, responding with a 400 JSON error body
// instead of the image. Feeding that JSON to sharp throws the cryptic
// "Input buffer contains unsupported image format". Always identify ourselves.
const DEFAULT_USER_AGENT = 'CubeCobra/1.0 (+https://cubecobra.com)';

const blankTile = (width: number, height: number): Promise<Buffer> =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();

const fetchTile = async (src: string, width: number, height: number): Promise<Buffer> => {
  // Imgur returns 429 for the default node-fetch user agent but is happy
  // with curl; every other host gets our descriptive application UA.
  const userAgent = src.includes('imgur') ? 'curl/8.5.0' : DEFAULT_USER_AGENT;

  const res = await safeFetch(src, {
    maxBytes: MAX_TILE_BYTES,
    timeoutMs: TILE_FETCH_TIMEOUT_MS,
    maxRedirects: TILE_MAX_REDIRECTS,
    headers: { 'User-Agent': userAgent },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }

  const image = sharp(res.body, { limitInputPixels: MAX_TILE_PIXELS });
  const { format } = await image.metadata();
  if (!format || !ALLOWED_TILE_FORMATS.has(format)) {
    throw new Error(`unsupported image format ${format ?? 'unknown'}`);
  }
  return image.resize({ width, height }).toBuffer();
};

/** Maps over `items` with at most `limit` calls in flight, preserving order. */
const mapWithConcurrency = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

export const generateSamplepackImage = async (
  sources: Array<{ src: string; x: number; y: number; width: number; height: number }> = [],
  width: number,
  height: number,
): Promise<Buffer> => {
  const images = await mapWithConcurrency(sources.slice(0, MAX_PACK_IMAGE_TILES), TILE_CONCURRENCY, async (source) => {
    let input: Buffer;
    try {
      input = await fetchTile(source.src, source.width, source.height);
    } catch (err) {
      // Fall back to a blank tile so one bad image can't fail the whole pack.
      console.log(`Failed to fetch image: ${source.src}. ${err instanceof Error ? err.message : err}`);
      input = await blankTile(source.width, source.height);
    }

    return {
      input,
      top: source.y,
      left: source.x,
    };
  });

  const options = {
    create: {
      width,
      height,
      channels: 3 as const,
      background: { r: 255, g: 255, b: 255 },
    },
  };

  return sharp(options).composite(images).webp({ effort: 6, alphaQuality: 0 }).toBuffer();
};
