import { Request, Response } from '../../../types/express';

export const imageProxyHandler = async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing or invalid URL parameter');
    }

    // Only allow Scryfall or our own card-image CDN URLs to prevent abuse
    const allowedPrefixes = ['https://cards.scryfall.io/', process.env.CARD_IMAGE_BASE_URL].filter(
      (prefix): prefix is string => Boolean(prefix),
    );
    if (!allowedPrefixes.some((prefix) => url.startsWith(prefix))) {
      return res.status(403).send('Only Scryfall or CubeCobra CDN image URLs are allowed');
    }

    // Fetch the image from Scryfall
    const response = await fetch(url);

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
