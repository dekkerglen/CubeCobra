import Card from '@utils/datatypes/Card';
import sharp from 'sharp';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

export const generatePackImage = async (pack: Card[]): Promise<Buffer> => {
  const width = Math.floor(Math.sqrt((5 / 3) * pack.length));
  const height = Math.ceil(pack.length / width);

  const sources = pack.map((card, index) => {
    const x = (index % width) * CARD_WIDTH;
    const y = Math.floor(index / width) * CARD_HEIGHT;
    return {
      src: card.details?.image_normal || card.details?.image_small || '',
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
