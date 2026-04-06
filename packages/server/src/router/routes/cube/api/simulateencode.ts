import rateLimit from 'express-rate-limit';

import { NextFunction, Request, Response } from '../../../../types/express';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
const ML_TIMEOUT_MS = 15_000;
const MAX_POOLS = 800; // max drafts × max seats

const encodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (req: Request) => (req as any).user?.id?.toString() ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({ success: false, message: 'Too many encode requests.' });
  },
});

/**
 * POST /cube/api/simulateencode
 *
 * Proxy: encodes a batch of draft pools through the ML encoder.
 * Body:  { pools: string[][] }
 * Response: { success: true, embeddings: number[][] }
 */
export const simulateencodeHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Must be logged in' });
  }

  const { pools } = req.body ?? {};
  if (!Array.isArray(pools)) {
    return res.status(400).json({ success: false, message: 'pools must be an array' });
  }
  if (pools.length > MAX_POOLS) {
    return res.status(400).json({ success: false, message: `Too many pools — maximum ${MAX_POOLS}` });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const response = await fetch(`${ML_SERVICE_URL}/batchencode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pools }),
      signal: controller.signal,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    req.logger.error(`Error in simulateencode proxy: ${err}`, err instanceof Error ? err.stack : '');
    if (err instanceof Error && err.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'ML service timed out' });
    }
    return res.status(500).json({ success: false, message: 'ML service unavailable' });
  } finally {
    clearTimeout(timeout);
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [encodeLimiter, simulateencodeHandler],
  },
];
