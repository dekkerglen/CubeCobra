import { Request, Response } from '../../../../types/express';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
const ML_TIMEOUT_MS = 15_000;

/**
 * POST /cube/api/simulateall
 *
 * Proxy for one pick round of the draft simulation.
 * Body:  { packs: string[][], pools: string[][] }
 * Returns: { success: true, picks: string[] }
 *
 * The client drives the full simulation loop (45 rounds), calling this once per pick.
 * Each call completes in a few seconds — well within the global timeout.
 *
 * Requires authentication — the ML service is a shared resource.
 */
const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Must be logged in' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/simulateall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
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
    handler: [handler],
  },
];
