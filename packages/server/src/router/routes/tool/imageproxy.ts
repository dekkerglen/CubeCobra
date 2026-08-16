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
    // 400, so we must identify ourselves — see imageUtils.ts.
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CubeCobra/1.0 (+https://cubecobra.com)' },
    });

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image');
    }

    // Get the image data as a buffer
    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=604800'); // Cache for 1 week
    res.set('Access-Control-Allow-Origin', '*'); // Allow CORS

    // Send the image data
    return res.send(Buffer.from(imageBuffer));
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
