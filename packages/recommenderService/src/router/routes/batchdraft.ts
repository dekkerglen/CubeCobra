import { batchDraft } from 'mlutils/ml';

import { Request, Response } from '../../types/express';

const handler = async (req: Request, res: Response) => {
  try {
    const { inputs } = req.body;

    if (!Array.isArray(inputs)) {
      return res.status(400).json({
        success: false,
        message: 'inputs must be an array',
      });
    }

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input || !Array.isArray(input.pack) || !Array.isArray(input.pool)) {
        return res.status(400).json({
          success: false,
          message: `inputs[${i}] must have pack and pool arrays`,
        });
      }
    }

    const results = batchDraft(inputs);

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (err) {
    req.logger.error(`Error in batchdraft: ${err}`, err instanceof Error ? err.stack : '');
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
