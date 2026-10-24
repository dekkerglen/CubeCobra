import sharp from 'sharp';

import { generatePackImage, generateSamplepackImage, MAX_PACK_IMAGE_TILES } from 'serverutils/imageUtils';
import { safeFetch } from 'serverutils/safeFetch';

import { createCard } from '../test-utils/data';

jest.mock('serverutils/safeFetch', () => ({
  safeFetch: jest.fn(),
}));

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

const TILE = { x: 0, y: 0, width: 20, height: 20 };

const solidPng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .png()
    .toBuffer();

const respondWith = (body: Buffer, status = 200) =>
  mockSafeFetch.mockResolvedValue({ status, headers: {}, body, url: 'https://cards.scryfall.io/x' });

// Color of the composite's top-left pixel: red when the tile rendered, white for a blank tile.
const topLeftPixel = async (image: Buffer) => {
  const { data } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
};

describe('generateSamplepackImage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockSafeFetch.mockReset();
  });

  it('fetches tiles through safeFetch with size, time and redirect limits', async () => {
    respondWith(await solidPng(40, 40));

    const image = await generateSamplepackImage([{ ...TILE, src: 'https://cards.scryfall.io/a.jpg' }], 20, 20);

    expect(mockSafeFetch).toHaveBeenCalledWith('https://cards.scryfall.io/a.jpg', {
      maxBytes: 5 * 1024 * 1024,
      timeoutMs: 5000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'CubeCobra/1.0 (+https://cubecobra.com)' },
    });
    const [r, g, b] = await topLeftPixel(image);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });

  it('keeps the curl user agent for imgur', async () => {
    respondWith(await solidPng(40, 40));

    await generateSamplepackImage([{ ...TILE, src: 'https://i.imgur.com/a.png' }], 20, 20);

    expect(mockSafeFetch.mock.calls[0]![1]!.headers).toEqual({ 'User-Agent': 'curl/8.5.0' });
  });

  it.each([
    ['an SVG', async () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>')],
    ['a non-image body', async () => Buffer.from('{"error":"bad request"}')],
    ['an image over the pixel limit', async () => solidPng(6000, 4500)],
  ])('renders a blank tile for %s', async (_label, body) => {
    respondWith(await body());

    const image = await generateSamplepackImage([{ ...TILE, src: 'https://example.com/a' }], 20, 20);

    expect(await topLeftPixel(image)).toEqual([255, 255, 255]);
  });

  it('renders a blank tile when the fetch is refused or fails', async () => {
    mockSafeFetch.mockRejectedValue(new Error('Refusing to connect to non-public address'));

    const image = await generateSamplepackImage([{ ...TILE, src: 'http://169.254.169.254/' }], 20, 20);

    expect(await topLeftPixel(image)).toEqual([255, 255, 255]);
  });

  it('renders a blank tile for a non-2xx response', async () => {
    respondWith(await solidPng(40, 40), 404);

    const image = await generateSamplepackImage([{ ...TILE, src: 'https://example.com/a' }], 20, 20);

    expect(await topLeftPixel(image)).toEqual([255, 255, 255]);
  });
});

describe('generatePackImage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockSafeFetch.mockReset();
  });

  it(`renders at most ${MAX_PACK_IMAGE_TILES} tiles however large the pack is`, async () => {
    mockSafeFetch.mockRejectedValue(new Error('offline'));
    const pack = Array.from({ length: 200 }, () => createCard({ imgUrl: 'https://example.com/a.png' }));

    const image = await generatePackImage(pack);

    expect(mockSafeFetch).toHaveBeenCalledTimes(MAX_PACK_IMAGE_TILES);
    const { width, height } = await sharp(image).metadata();
    // 30 tiles lay out as 7 columns x 5 rows of 488x680 cards.
    expect(width).toBe(7 * 488);
    expect(height).toBe(5 * 680);
  });
});
