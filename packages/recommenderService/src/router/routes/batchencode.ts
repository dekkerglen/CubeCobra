import { batchEncode } from 'mlutils/ml';

import { Request, Response } from '../../types/express';

/**
 * POST /batchencode
 *
 * Encodes a batch of draft pools through the encoder in a single forward pass.
 * Body:  { pools: string[][] }  — one array of oracle IDs per pool
 * Response: { success: true, embeddings: number[][] }  — one embedding vector per pool
 */
const handler = async (req: Request, res: Response) => {
  try {
    const { pools } = req.body;

    if (!Array.isArray(pools)) {
      return res.status(400).json({ success: false, message: 'pools must be an array' });
    }

    for (let i = 0; i < pools.length; i++) {
      if (!Array.isArray(pools[i])) {
        return res.status(400).json({ success: false, message: `pools[${i}] must be an array of oracle IDs` });
      }
    }

    const embeddings = batchEncode(pools as string[][]);

    return res.status(200).json({ success: true, embeddings });
  } catch (err) {
    req.logger.error(`Error in batchencode: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const routes = [
  {
    path: '',
    method: 'post',
    handler: [handler],
  },
];
