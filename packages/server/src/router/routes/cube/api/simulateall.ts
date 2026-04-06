import rateLimit from 'express-rate-limit';
import { verifySimToken } from 'serverutils/simToken';

import { NextFunction, Request, Response } from '../../../../types/express';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
const ML_TIMEOUT_MS = 15_000;

// Max packs/pools elements per call — numDrafts × numSeats = 50 × 16
const MAX_SEATS = 800;

// 100 req/min per user — generous for one sim (45 calls) but blocks rapid multi-sim abuse
const pickLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: Request) => (req as any).user?.id?.toString() ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({ success: false, message: 'Too many simulation pick requests. Please wait before starting another simulation.' });
  },
});

/**
 * POST /cube/api/simulateall
 *
 * Proxy for one pick round of the draft simulation.
 * Body:  { cubeId, simToken, packs: string[][], pools: string[][] }
 * Returns: { success: true, picks: string[] }
 *
 * simToken is issued by simulatesetup and verified here with HMAC — avoids a
 * DynamoDB lookup on every one of the ~45 pick calls per simulation.
 */
export const simulateallHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Must be logged in' });
  }

  const { cubeId, simToken, packs, pools } = req.body ?? {};

  if (!cubeId) {
    return res.status(400).json({ success: false, message: 'Cube ID required' });
  }
  if (!simToken || !verifySimToken(simToken, req.user.id.toString(), cubeId)) {
    return res.status(403).json({ success: false, message: 'Invalid or expired simulation session. Please start a new simulation.' });
  }
  if (!Array.isArray(packs) || !Array.isArray(pools)) {
    return res.status(400).json({ success: false, message: 'packs and pools must be arrays' });
  }
  if (packs.length > MAX_SEATS || pools.length > MAX_SEATS) {
    return res.status(400).json({ success: false, message: `Too many seats — maximum ${MAX_SEATS}` });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/simulateall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packs, pools }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({ success: false, message: 'Invalid ML service response' }));
    return res.status(response.status).json(data);
  } catch (err) {
    req.logger.error(`Error in simulateall proxy: ${err}`, err instanceof Error ? err.stack : '');
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
    handler: [pickLimiter, simulateallHandler],
  },
];
