import Joi from 'joi';
import { getOracleForMl } from 'serverutils/carddb';
import { batchDraft } from 'serverutils/ml';

import { NextFunction, Request, Response } from '../../../../types/express';

interface PredictBody {
  inputs: {
    pack: string[]; // oracle id
    picks: string[]; // oracle id
  }[];
}

export interface PredictResponse {
  prediction: {
    oracle: string;
    rating: number;
  }[][];
}

const OracleIDSchema = Joi.string().uuid();
const CustomCard = Joi.string().valid('custom-card');

const PredictBodySchema = Joi.object({
  inputs: Joi.array()
    .items(
      Joi.object({
        pack: Joi.array().items(OracleIDSchema, CustomCard).required(),
        picks: Joi.array().items(OracleIDSchema, CustomCard).required(),
      }),
    )
    .required()
    .max(20),
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
    const inputs = predictBody.inputs;

    // Validate all inputs up front
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input || !input.pack || !input.picks) {
        throw new Error(`Invalid input at index ${i}`);
      }
    }

    // Build ML substitution maps per input
    const seatMaps = inputs.map((input) => {
      const toMl: Record<string, string> = {};
      const fromMl: Record<string, string> = {};
      for (const oracle of [...input.pack, ...input.picks]) {
        if (toMl[oracle] !== undefined) continue;
        const mlOracle = getOracleForMl(oracle, null);
        toMl[oracle] = mlOracle;
        if (!fromMl[mlOracle]) fromMl[mlOracle] = oracle;
      }
      return { toMl, fromMl };
    });

    // Single batched ML call — the model processes all inputs in one tensor forward pass
    const mlPrediction = await batchDraft(
      inputs.map((input, idx) => {
        const { toMl } = seatMaps[idx]!;
        return {
          pack: input.pack.map((o) => toMl[o] ?? o),
          pool: input.picks.map((o) => toMl[o] ?? o),
        };
      }),
    );

    // Map ML oracles back to originals
    const prediction = mlPrediction.map((seatResult, idx) => {
      const { fromMl } = seatMaps[idx]!;
      return seatResult.map((item) => ({
        oracle: fromMl[item.oracle] ?? item.oracle,
        rating: item.rating,
      }));
    });

    const result: PredictResponse = {
      prediction,
    };

    return res.status(200).send(result);
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
