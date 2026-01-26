import Joi from 'joi';
import { draft } from 'serverutils/ml';

import { NextFunction, Request, Response } from '../../../../types/express';

interface PredictBody {
  pack: string[]; // oracle id
  picks: string[]; // oracle id
}

const OracleIDSchema = Joi.string().uuid();
const CustomCard = Joi.string().valid('custom-card');

const PredictBodySchema = Joi.object({
  pack: Joi.array().items(OracleIDSchema, CustomCard).required(),
  picks: Joi.array().items(OracleIDSchema, CustomCard).required(),
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
    const prediction = await draft(predictBody.pack, predictBody.picks);

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
