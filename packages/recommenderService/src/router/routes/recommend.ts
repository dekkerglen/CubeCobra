import { recommend } from 'mlutils/ml';

import { Request, Response } from '../../types/express';

const handler = async (req: Request, res: Response) => {
  try {
    const { oracles, eligibleOracles, skip, limit } = req.body;

    if (!Array.isArray(oracles)) {
      return res.status(400).json({
        success: false,
        message: 'oracles must be an array',
      });
    }

    if (eligibleOracles !== undefined && !Array.isArray(eligibleOracles)) {
      return res.status(400).json({
        success: false,
        message: 'eligibleOracles must be an array when provided',
      });
    }

    console.log(
      `[Recommend] Received request: ${oracles.length} cube oracles` +
        (Array.isArray(eligibleOracles)
          ? `, ${eligibleOracles.length} eligible oracles, skip=${skip}, limit=${limit}`
          : ''),
    );

    const result = recommend(oracles, {
      eligibleOracles: Array.isArray(eligibleOracles) ? eligibleOracles : undefined,
      skip: typeof skip === 'number' ? skip : undefined,
      limit: typeof limit === 'number' ? limit : undefined,
    });

    console.log(
      `[Recommend] Result: ${result.adds.length} adds (of ${result.totalAdds}), ${result.cuts.length} cuts`,
    );
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
