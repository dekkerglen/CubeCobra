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

    const result = recommend(oracles);

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
