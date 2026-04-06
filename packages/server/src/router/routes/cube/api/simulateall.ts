import { cubeDao } from 'dynamo/daos';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

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
export const simulateallHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Must be logged in' });
  }

  const cubeId = req.body?.cubeId;
  if (!cubeId) {
    return res.status(400).json({ success: false, message: 'Cube ID required' });
  }

  const cube = await cubeDao.getById(cubeId);
  if (!cube || !isCubeViewable(cube, req.user)) {
    return res.status(404).json({ success: false, message: 'Cube not found' });
  }
  if (!isCubeEditable(cube, req.user)) {
    return res.status(403).json({ success: false, message: 'Only the cube owner or collaborators can run the draft simulator' });
  }

  const { packs, pools } = req.body ?? {};
  if (!Array.isArray(packs) || !Array.isArray(pools)) {
    return res.status(400).json({ success: false, message: 'packs and pools must be arrays' });
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
    handler: [simulateallHandler],
  },
];
