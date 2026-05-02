import { Request, Response } from '../../../types/express';

// Bucket is in us-east-2 — do not use AWS_REGION which may differ in dev/prod environments
const PUBLIC_MODEL_BASE = `https://cubecobra-public.s3.us-east-2.amazonaws.com/model`;

/**
 * GET /api/mlmodel/*
 *
 * Proxies model files from the public S3 bucket so the browser can load
 * TF.js graph models without requiring S3 CORS configuration.
 * Heavy files (~69 MB each) are cached by the browser for one week.
 */
const mlModelHandler = async (req: Request, res: Response) => {
  const modelPath = (req.params as any)[0] as string | undefined;
  if (!modelPath) {
    return res.status(400).json({ error: 'Model path required' });
  }

  // Prevent path traversal
  const normalized = modelPath.replace(/\.\./g, '').replace(/^\/+/, '');
  const url = `${PUBLIC_MODEL_BASE}/${normalized}`;

  const contentType = normalized.endsWith('.json') ? 'application/json' : 'application/octet-stream';

  try {
    // Forward conditional request headers so S3 can return 304 when the file hasn't changed
    const s3Headers: Record<string, string> = {};
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch) s3Headers['If-None-Match'] = ifNoneMatch as string;
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) s3Headers['If-Modified-Since'] = ifModifiedSince as string;

    const s3res = await fetch(url, { headers: s3Headers });

    if (s3res.status === 304) {
      return res.status(304).end();
    }
    if (s3res.status === 404) {
      return res.status(404).json({ error: 'Model file not found' });
    }
    if (!s3res.ok) {
      req.logger.error(`S3 fetch failed for ${url}: ${s3res.status}`);
      return res.status(500).json({ error: 'Failed to fetch model file' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week
    const contentLength = s3res.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const etag = s3res.headers.get('etag');
    if (etag) res.setHeader('ETag', etag);
    const lastModified = s3res.headers.get('last-modified');
    if (lastModified) res.setHeader('Last-Modified', lastModified);

    // Stream the response body directly to the client
    const reader = s3res.body?.getReader();
    if (!reader) {
      return res.status(404).json({ error: 'Model file not found' });
    }

    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(Buffer.from(value));
      return pump();
    };
    return pump();
  } catch (err: any) {
    req.logger.error(`Error fetching ML model file ${url}: ${err}`);
    return res.status(500).json({ error: 'Failed to fetch model file' });
  }
};

export const routes = [{ method: 'get', path: '/*', handler: [mlModelHandler] }];
