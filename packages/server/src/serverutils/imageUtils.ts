import Card from '@utils/datatypes/Card';
import sharp from 'sharp';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

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

export const generatePackImage = async (pack: Card[]): Promise<Buffer> => {
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

export const generateSamplepackImage = async (
  sources: Array<{ src: string; x: number; y: number; width: number; height: number }> = [],
  width: number,
  height: number,
): Promise<Buffer> => {
  const images = await Promise.all(
    sources.map(async (source) => {
      // Imgur returns 429 for the default node-fetch user agent but is happy
      // with curl; every other host gets our descriptive application UA.
      const userAgent = source.src.includes('imgur') ? 'curl/8.5.0' : DEFAULT_USER_AGENT;

      let input: Buffer;
      try {
        const res = await fetch(source.src, { headers: { 'User-Agent': userAgent } });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        input = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: source.width, height: source.height })
          .toBuffer();
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
    }),
  );

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
