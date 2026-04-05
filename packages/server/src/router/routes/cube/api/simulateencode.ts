import { Request, Response } from '../../../../types/express';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';

/**
 * POST /cube/api/simulateencode
 *
 * Proxy: encodes a batch of draft pools through the ML encoder.
 * Body:  { pools: string[][] }
 * Response: { success: true, embeddings: number[][] }
 */
const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Must be logged in' });
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL}/batchencode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    req.logger.error(`Error in simulateencode proxy: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'ML service unavailable' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [handler],
  },
];
