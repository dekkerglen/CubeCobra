import { getOracleForMl } from 'serverutils/carddb';

import { Request, Response } from '../../../../types/express';

export const mlsubstitutionsHandler = async (req: Request, res: Response) => {
  try {
    const oracles = Array.isArray(req.body?.oracles) ? req.body.oracles : null;
    if (!oracles) {
      return res.status(400).json({
        success: false,
        message: 'Expected body.oracles to be an array of oracle IDs',
      });
    }

    const remapping: Record<string, string> = {};
    for (const oracle of oracles) {
      if (typeof oracle !== 'string' || oracle.length === 0) continue;
      const mlOracle = getOracleForMl(oracle, null);
      if (mlOracle && mlOracle !== oracle) {
        remapping[oracle] = mlOracle;
      }
    }

    return res.status(200).json({
      success: true,
      remapping,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute ML substitutions',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: mlsubstitutionsHandler,
  },
];
