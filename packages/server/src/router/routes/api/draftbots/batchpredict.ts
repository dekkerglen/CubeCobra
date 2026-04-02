import Joi from 'joi';
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
const VoucherCard = Joi.string().valid('voucher');

const PredictBodySchema = Joi.object({
  inputs: Joi.array()
    .items(
      Joi.object({
        pack: Joi.array().items(OracleIDSchema, CustomCard, VoucherCard).required(),
        picks: Joi.array().items(OracleIDSchema, CustomCard, VoucherCard).required(),
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

    // Single batched ML call — the model processes all inputs in one tensor forward pass
    const prediction = await batchDraft(
      inputs.map((input) => ({ pack: input.pack, pool: input.picks })),
    );

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
