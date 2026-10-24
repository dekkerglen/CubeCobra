import { safeFetch } from 'serverutils/safeFetch';

import { Request, Response } from '../../../types/express';

// Origins the proxy is allowed to fetch from, to prevent it being used as an
// open proxy. Scryfall is always allowed (legacy `imgUrl` values and the
// fallback when CARD_IMAGE_BASE_URL is unset still point there). When card
// images are self-hosted, their URLs are `${CARD_IMAGE_BASE_URL}/...` (R2 via
// Cloudflare) — see packages/jobs/src/update_cards.ts — so that origin, and the
// general CDN origin, must be allowed too.
const getAllowedOrigins = (): string[] => {
  const origins = ['https://cards.scryfall.io'];
  for (const envUrl of [process.env.CARD_IMAGE_BASE_URL, process.env.CDN_BASE_URL]) {
    if (envUrl) {
      try {
        origins.push(new URL(envUrl).origin);
      } catch {
        // Ignore malformed env values.
      }
    }
  }
  return origins;
};

// Responses are served from our own origin, so only plain raster image types pass through (an
// SVG or HTML body would otherwise run as same-origin content), and each fetch is bounded.
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export const imageProxyHandler = async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing or invalid URL parameter');
    }

    // Only allow known image hosts to prevent the proxy being abused.
    let requestedOrigin: string;
    try {
      requestedOrigin = new URL(url).origin;
    } catch {
      return res.status(400).send('Missing or invalid URL parameter');
    }
    if (!getAllowedOrigins().includes(requestedOrigin)) {
      return res.status(403).send('Image URL host is not allowed');
    }

    // Fetch the image from the allowed host. Scryfall (and other well-behaved
    // hosts) reject requests that send a default HTTP-library User-Agent with a
    // 400, so we must identify ourselves — see imageUtils.ts. Redirects are not
    // followed, since they could lead off the allowlisted hosts.
    let response;
    try {
      response = await safeFetch(url, {
        maxBytes: MAX_IMAGE_BYTES,
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRedirects: 0,
        headers: { 'User-Agent': 'CubeCobra/1.0 (+https://cubecobra.com)' },
      });
    } catch {
      return res.status(502).send('Failed to fetch image');
    }

    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status >= 400 ? response.status : 502).send('Failed to fetch image');
    }

    const contentType = String(response.headers['content-type'] || '')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return res.status(415).send('Unsupported image type');
    }

    res.set('Content-Type', contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.set('Cache-Control', 'public, max-age=604800'); // Cache for 1 week
    res.set('Access-Control-Allow-Origin', '*'); // Allow CORS

    return res.send(response.body);
  } catch (error) {
    console.error('Image proxy error:', error);
    return res.status(500).send('Internal server error');
  }
};

export const routes = [
  {
    method: 'get',
    path: '',
    handler: [imageProxyHandler],
  },
];
