import Joi from 'joi';

import Cube from '../../../../dynamo/models/cube';
import p1p1PackModel from '../../../../dynamo/models/p1p1Pack';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { createHydratedP1P1Pack } from '../../../../server/util/userUtil';
import { Request, Response } from '../../../../types/express';
import { cardFromId } from '../../../../util/carddb';
import { isCubeViewable } from '../../../../util/cubefn';
import { bodyValidation } from '../../../middleware/bodyValidation';

const CreateP1P1FromPackSchema = Joi.object({
  cubeId: Joi.string().uuid().required().messages({
    'string.guid': 'Cube ID must be a valid UUID',
    'any.required': 'Cube ID is required',
  }),
  seed: Joi.string().required().messages({
    'any.required': 'Seed is required',
  }),
  cardIds: Joi.array().items(Joi.string().min(1)).min(1).max(30).required().messages({
    'array.min': 'At least one card ID is required',
    'array.max': 'Pack size too large (max 30 cards)',
    'any.required': 'Card IDs array is required',
  }),
});

export const createP1P1FromPackHandler = async (req: Request, res: Response) => {
  try {
    const { cubeId, seed, cardIds } = req.body;
    const { user } = req;

    // ensureAuth middleware guarantees user exists but we're doing this for typescript
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the cube
    const cube = await Cube.getById(cubeId);
    if (!isCubeViewable(cube, user)) {
      return res.status(404).json({ error: 'Cube not found' });
    }

    // Validate card IDs exist in card database
    const validCardIds: string[] = [];
    for (const cardId of cardIds) {
      try {
        const details = cardFromId(cardId);
        if (details) {
          validCardIds.push(cardId);
        }
      } catch (error) {
        // Skip invalid card IDs, log if needed
        req.logger.error(`Invalid card ID ${cardId}:`, error);
      }
    }

    if (validCardIds.length === 0) {
      return res.status(400).json({ error: 'No valid cards found' });
    }

    // Create P1P1 pack record with user information, preserving card IDs
    const packDataWithUser = await createHydratedP1P1Pack(
      {
        cubeId: cube.id,
        cards: validCardIds,
        seed: seed,
      },
      user.id,
      user.username,
    );

    const p1p1Pack = await p1p1PackModel.put(packDataWithUser);

    return res.status(200).json({
      success: true,
      pack: p1p1Pack,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error creating P1P1 pack from existing data' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [ensureAuth, csrfProtection, bodyValidation(CreateP1P1FromPackSchema), createP1P1FromPackHandler],
  },
];
