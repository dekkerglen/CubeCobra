import { recommend } from 'mlutils/ml';

import { Request, Response } from '../../types/express';

const handler = async (req: Request, res: Response) => {
  try {
    const { oracles } = req.body;

    if (!Array.isArray(oracles)) {
      return res.status(400).json({
        success: false,
        message: 'oracles must be an array',
      });
    }

    console.log(`[Recommend] Received request with ${oracles.length} oracles:`, oracles);

    const result = recommend(oracles);

    console.log(`[Recommend] Result: ${result.adds.length} adds, ${result.cuts.length} cuts`);
    if (result.adds.length === 0 && result.cuts.length === 0) {
      console.log('[Recommend] No recommendations returned - possible oracle mapping issue');
    }

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    req.logger.error(`Error in recommend: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const routes = [
  {
    path: '',
    method: 'post',
    handler: [handler],
  },
];
