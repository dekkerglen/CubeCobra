import p1p1PackModel from 'dynamo/models/p1p1Pack';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

export const VoteP1P1Schema = Joi.object({
  packId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid pack ID format',
    'any.required': 'Pack ID is required',
  }),
  cardIndex: Joi.number().integer().min(0).required().messages({
    'number.integer': 'Card index must be an integer',
    'number.min': 'Card index must be non-negative',
    'any.required': 'Card index is required',
  }),
});

export const voteP1P1Handler = async (req: Request, res: Response) => {
  try {
    const { packId, cardIndex } = req.body;
    const { user } = req;

    // ensureAuth middleware guarantees user exists but we're doing this for typescript
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate pack exists
    const pack = await p1p1PackModel.getById(packId);
    if (!pack) {
      return res.status(404).json({ error: 'P1P1 pack not found' });
    }

    // Add vote (this handles updating existing votes)
    const updatedPack = await p1p1PackModel.addVote(pack, user.id, cardIndex);

    if (!updatedPack) {
      return res.status(404).json({ error: 'Failed to update pack with vote' });
    }

    // Get vote summary
    const voteSummary = p1p1PackModel.getVoteSummary(updatedPack, user.id);

    return res.status(200).json({
      success: true,
      votes: voteSummary,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error submitting vote' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [ensureAuth, csrfProtection, bodyValidation(VoteP1P1Schema), voteP1P1Handler],
  },
];
