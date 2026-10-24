import { safeFetch, SafeFetchError } from 'serverutils/safeFetch';

import { imageProxyHandler } from '../../../src/router/routes/tool/imageproxy';
import { Request, Response } from '../../../src/types/express';

jest.mock('serverutils/safeFetch', () => ({
  ...jest.requireActual('serverutils/safeFetch'),
  safeFetch: jest.fn(),
}));

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

const SCRYFALL_URL = 'https://cards.scryfall.io/normal/front/a/b/ab.jpg';

const respondWith = (contentType: string | undefined, status = 200) =>
  mockSafeFetch.mockResolvedValue({
    status,
    headers: contentType ? { 'content-type': contentType } : {},
    body: Buffer.from('image-bytes'),
    url: SCRYFALL_URL,
  });

// Calls the handler with a response stub that records status, headers and body.
const proxy = async (url: unknown) => {
  const result = { status: 200, headers: {} as Record<string, string>, body: undefined as unknown };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    set(name: string, value: string) {
      result.headers[name.toLowerCase()] = value;
      return this;
    },
    send(body: unknown) {
      result.body = body;
      return this;
    },
  };
  await imageProxyHandler({ query: { url } } as unknown as Request, res as unknown as Response);
  return result;
};

describe('Image proxy', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockSafeFetch.mockReset();
  });

  it('rejects hosts outside the allowlist without fetching', async () => {
    const res = await proxy('https://evil.example/a.png');

    expect(res.status).toBe(403);
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('fetches with a byte cap, a timeout and no redirects', async () => {
    respondWith('image/jpeg');

    await proxy(SCRYFALL_URL);

    expect(mockSafeFetch).toHaveBeenCalledWith(SCRYFALL_URL, {
      maxBytes: 10 * 1024 * 1024,
      timeoutMs: 10_000,
      maxRedirects: 0,
      headers: { 'User-Agent': 'CubeCobra/1.0 (+https://cubecobra.com)' },
    });
  });

  it.each([
    ['image/jpeg', 'image/jpeg'],
    ['image/png', 'image/png'],
    ['image/webp', 'image/webp'],
    ['Image/GIF; charset=binary', 'image/gif'],
  ])('passes through %s with locked-down headers', async (upstreamType, servedType) => {
    respondWith(upstreamType);

    const res = await proxy(SCRYFALL_URL);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(Buffer.from('image-bytes'));
    expect(res.headers['content-type']).toBe(servedType);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
  });

  it.each(['image/svg+xml', 'text/html', 'application/octet-stream', undefined])(
    'refuses to serve %s',
    async (contentType) => {
      respondWith(contentType);

      const res = await proxy(SCRYFALL_URL);

      expect(res.status).toBe(415);
      expect(res.body).not.toEqual(Buffer.from('image-bytes'));
    },
  );

  it('fails cleanly when the fetch is refused, redirected, too large or times out', async () => {
    mockSafeFetch.mockRejectedValue(new SafeFetchError('Too many redirects'));

    const res = await proxy(SCRYFALL_URL);

    expect(res.status).toBe(502);
  });

  it('passes through upstream error statuses', async () => {
    respondWith('text/html', 404);

    const res = await proxy(SCRYFALL_URL);

    expect(res.status).toBe(404);
  });
});
