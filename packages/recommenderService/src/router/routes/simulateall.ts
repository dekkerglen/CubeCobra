import { draftBatch } from 'mlutils/ml';

import { Request, Response } from '../../types/express';

/**
 * POST /simulateall
 *
 * Runs one pick round for a batch of seats across all drafts.
 * The client drives the simulation loop (45 rounds for a standard draft),
 * calling this endpoint once per pick round.
 *
 * Body:  { packs: string[][], pools: string[][] }
 *          — one entry per seat across all drafts (numDrafts × numSeats entries)
 * Response: { success: true, picks: string[] }
 *          — one oracle ID per seat (the top ML pick)
 */
const handler = (req: Request, res: Response) => {
  const { packs, pools } = req.body;

  if (!Array.isArray(packs) || !Array.isArray(pools)) {
    return res.status(400).json({ success: false, message: 'packs and pools must be arrays' });
  }

  try {
    const results = draftBatch(packs as string[][], pools as string[][]);
    const picks = results.map((r) => r[0]?.oracle ?? '');
    return res.status(200).json({ success: true, picks });
  } catch (err) {
    req.logger.error(`Error in simulateall: ${err}`, err instanceof Error ? err.stack : '');
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
