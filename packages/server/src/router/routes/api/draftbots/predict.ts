import Joi from 'joi';
import { getOracleForMl } from 'serverutils/carddb';
import { draft } from 'serverutils/ml';

import { NextFunction, Request, Response } from '../../../../types/express';

interface PredictBody {
  pack: string[]; // oracle id
  picks: string[]; // oracle id
}

const OracleIDSchema = Joi.string().uuid();
const CustomCard = Joi.string().valid('custom-card');
const VoucherCard = Joi.string().valid('voucher');

const PredictBodySchema = Joi.object({
  pack: Joi.array().items(OracleIDSchema, CustomCard, VoucherCard).required(),
  picks: Joi.array().items(OracleIDSchema, CustomCard, VoucherCard).required(),
});

const validatePredictBody = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = PredictBodySchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    return;
  }
  next();
};

const handler = async (req: Request, res: Response) => {
  const predictBody = req.body as PredictBody;

  try {
    // Map oracle IDs to ML-known oracles
    const toMl: Record<string, string> = {};
    const fromMl: Record<string, string[]> = {};
    for (const oracle of [...predictBody.pack, ...predictBody.picks]) {
      if (toMl[oracle] !== undefined) continue;
      const mlOracle = getOracleForMl(oracle, null);
      toMl[oracle] = mlOracle;
      // Track ALL original oracles that map to each ML oracle
      if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
      fromMl[mlOracle].push(oracle);
    }

    const mlPack = predictBody.pack.map((o) => toMl[o] ?? o);
    const mlPicks = predictBody.picks.map((o) => toMl[o] ?? o);

    const mlPrediction = await draft(mlPack, mlPicks);

    // Map ML oracles back to ALL original oracle IDs that mapped to them
    const prediction = mlPrediction.flatMap((item) =>
      (fromMl[item.oracle] ?? [item.oracle]).map((oracle) => ({
        oracle,
        rating: item.rating,
      })),
    );

    return res.status(200).send({
      prediction,
    });
  } catch (error) {
    console.error('Error getting prediction', error);
    return res.status(500).json({ error: 'Error getting prediction' });
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [validatePredictBody, handler],
  },
];
