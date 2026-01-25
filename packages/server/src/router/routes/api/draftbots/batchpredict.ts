import Joi from 'joi';
import { draft } from 'serverutils/ml';

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
    // Pre-allocate array to avoid reallocation during map
    const inputs = predictBody.inputs;
    const prediction = new Array(inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input || !input.pack || !input.picks) {
        throw new Error(`Invalid input at index ${i}`);
      }
      prediction[i] = draft(input.pack, input.picks);
    }

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
