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

export const generateSamplepackImage = async (
  sources: Array<{ src: string; x: number; y: number; width: number; height: number }> = [],
  width: number,
  height: number,
): Promise<Buffer> => {
  const images = await Promise.all(
    sources.map(async (source) => {
      const fetchOptions = source.src.includes('imgur')
        ? {
            headers: {
              //Imgur returns a 429 error using the default node-fetch useragent, but it is happy with curl!
              'User-Agent': 'curl/8.5.0',
            },
          }
        : {};

      const res = await fetch(source.src, fetchOptions);

      if (!res.ok) {
        console.log(`Failed to fetch image: ${source.src}. Response statuses: ${res.status}, ${res.statusText}`);
      }

      return {
        input: await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: source.width, height: source.height })
          .toBuffer(),
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
