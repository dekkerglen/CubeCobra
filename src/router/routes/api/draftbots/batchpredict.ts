import { NextFunction, Request, Response } from 'express-serve-static-core';
import Joi from 'joi';

import { draft } from '../../../../util/ml';

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

const PredictBodySchema = Joi.object({
  inputs: Joi.array()
    .items(
      Joi.object({
        pack: Joi.array().items(OracleIDSchema).required(),
        picks: Joi.array().items(OracleIDSchema).required(),
      }),
    )
    .required()
    .max(20),
});

const validatePredictBody = (req: Request, res: Response, next: NextFunction) => {
  const { error } = PredictBodySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

const handler = async (req: Request, res: Response) => {
  const predictBody = req.body as PredictBody;

  try {
    const prediction = predictBody.inputs.map((input) => draft(input.pack, input.picks));

    const result: PredictResponse = {
      prediction,
    };

    return res.status(200).send(result);
  } catch (error) {
    // eslint-disable-next-line no-console
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
