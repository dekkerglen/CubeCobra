import { draft } from 'mlutils/ml';

import { Request, Response } from '../../types/express';

const handler = async (req: Request, res: Response) => {
  try {
    const { pack, pool } = req.body;

    if (!Array.isArray(pack) || !Array.isArray(pool)) {
      return res.status(400).json({
        success: false,
        message: 'pack and pool must be arrays',
      });
    }

    const result = draft(pack, pool);

    return res.status(200).json({
      success: true,
      cards: result,
    });
  } catch (err) {
    req.logger.error(`Error in draft: ${err}`, err instanceof Error ? err.stack : '');
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
