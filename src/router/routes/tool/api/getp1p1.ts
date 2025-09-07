import Joi from 'joi';

import p1p1PackModel from '../../../../dynamo/models/p1p1Pack';
import { NextFunction, Request, Response } from '../../../../types/express';

const ParamsSchema = Joi.object({
  packId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid pack ID format',
    'any.required': 'Pack ID is required'
  })
});

export const validateParams = (req: Request, res: Response, next: NextFunction) => {
  const { error } = ParamsSchema.validate(req.params);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const getP1P1Handler = async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;
    const { user } = req;

    // Get the pack
    const pack = await p1p1PackModel.getById(packId);
    if (!pack) {
      return res.status(404).json({ error: 'P1P1 pack not found' });
    }

    // Get vote summary (includes user's vote if logged in)
    const voteSummary = p1p1PackModel.getVoteSummary(pack, user?.id);

    return res.status(200).json({
      success: true,
      pack,
      votes: voteSummary,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error fetching P1P1 pack' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:packId',
    handler: [validateParams, getP1P1Handler],
  },
];