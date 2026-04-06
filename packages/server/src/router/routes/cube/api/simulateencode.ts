import { cubeDao } from 'dynamo/daos';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
const ML_TIMEOUT_MS = 15_000;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const response = await fetch(`${ML_SERVICE_URL}/batchencode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
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
    handler: [simulateencodeHandler],
  },
];
