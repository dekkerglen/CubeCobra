import Joi from 'joi';
import { getOracleForMl } from 'serverutils/carddb';
import { batchDraft } from 'serverutils/ml';

import { NextFunction, Request, Response } from '../../../../types/express';

interface PredictBody {
  inputs: {
    pack: string[]; // oracle id
    picks: string[]; // oracle id
  }[];
  cubeContext?: number[]; // 32-dim cube context embedding shared across inputs
}

export interface PredictResponse {
  prediction: {
    oracle: string;
    rating: number;
  }[][];
}

const OracleIDSchema = Joi.string().uuid();
const CustomCard = Joi.string().valid('custom-card');

const CUBE_CONTEXT_DIM = 32;

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
  cubeContext: Joi.array().items(Joi.number()).length(CUBE_CONTEXT_DIM).optional(),
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

    // Map oracle IDs to ML-known oracles per seat, mirroring predict.ts. Cards in the
    // training vocab pass through unchanged; unknown cards fall back to a mostSimilar.
    const seatMaps = inputs.map((input) => {
      const toMl: Record<string, string> = {};
      const fromMl: Record<string, string[]> = {};
      for (const oracle of [...input.pack, ...input.picks]) {
        if (toMl[oracle] !== undefined) continue;
        const mlOracle = getOracleForMl(oracle, null);
        toMl[oracle] = mlOracle;
        if (!fromMl[mlOracle]) fromMl[mlOracle] = [];
        fromMl[mlOracle].push(oracle);
      }
      return { toMl, fromMl };
    });

    // Single batched ML call — the model processes all inputs in one tensor forward pass.
    // All inputs in a batch represent seats of a single draft and share the same cube context.
    const mlPrediction = await batchDraft(
      inputs.map((input, i) => ({
        pack: input.pack.map((o) => seatMaps[i]!.toMl[o] ?? o),
        pool: input.picks.map((o) => seatMaps[i]!.toMl[o] ?? o),
        cubeContext: predictBody.cubeContext,
      })),
    );

    // Map ML oracles back to ALL original oracle IDs that mapped to them, per seat.
    const prediction = mlPrediction.map((seatResult, i) => {
      const { fromMl } = seatMaps[i]!;
      return seatResult.flatMap((item) =>
        (fromMl[item.oracle] ?? [item.oracle]).map((oracle) => ({
          oracle,
          rating: item.rating,
        })),
      );
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
