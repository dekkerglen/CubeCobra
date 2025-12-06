import Card from '@utils/datatypes/Card';
import Cube from 'dynamo/models/cube';
import p1p1PackModel from 'dynamo/models/p1p1Pack';
import Joi from 'joi';
import { cardFromId } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';

import { getBotPrediction } from 'serverutils/userUtil';
import { Request, Response } from '../../../../types/express';

const CreateP1P1FromPackSchema = Joi.object({
  cubeId: Joi.string().required().messages({
    'any.required': 'Cube ID is required',
  }),
  seed: Joi.string().required().messages({
    'any.required': 'Seed is required',
  }),
  cards: Joi.array()
    .items(
      Joi.object({
        cardID: Joi.string().required(),
        index: Joi.number().optional(),
      }),
    )
    .min(1)
    .max(30)
    .required()
    .messages({
      'array.min': 'At least one card is required',
      'array.max': 'Pack size too large (max 30 cards)',
      'any.required': 'Cards array is required',
    }),
});

export const createP1P1FromPackHandler = async (req: Request, res: Response) => {
  try {
    const { cubeId, seed, cards: packCards } = req.body;
    const { user } = req;

    // ensureAuth middleware guarantees user exists but we're doing this for typescript
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the cube metadata
    const cube = await Cube.getById(cubeId);
    if (!cube || !isCubeViewable(cube, user)) {
      return res.status(404).json({ error: 'Cube not found' });
    }

    // Get the actual cards from S3 (getById only returns metadata)
    const cubeCards = await Cube.getCards(cubeId);

    // Get actual Card objects from the cube for the given cards
    const cards: Card[] = [];
    const oracleIds: string[] = [];

    // Combine mainboard and maybeboard to search all cube cards
    const allCubeCards = [...(cubeCards.mainboard || []), ...(cubeCards.maybeboard || [])];

    for (const packCard of packCards) {
      try {
        // Prefer matching by index if available (handles duplicate cardIDs with different properties)
        // Otherwise fall back to matching by cardID (for backwards compatibility)
        const cubeCard =
          packCard.index !== undefined
            ? allCubeCards.find((card) => card.index === packCard.index)
            : allCubeCards.find((card) => card.cardID === packCard.cardID);

        if (cubeCard) {
          // Use the actual Card object from the cube (with all its properties like tags, status, finish, imgUrl, etc.)
          cards.push(cubeCard);

          // Collect oracle IDs for bot prediction (use existing details from cube card)
          if (cubeCard.details?.oracle_id) {
            oracleIds.push(cubeCard.details.oracle_id);
          }
        } else {
          req.logger.error(`Card not found in cube ${cubeId}: cardID=${packCard.cardID}, index=${packCard.index}`);

          // Fallback: Create a basic card with details if not found in cube
          // This can happen if the pack was generated with different card data than what's stored in cube
          const details = cardFromId(packCard.cardID);
          if (details) {
            const fallbackCard: Card = {
              cardID: packCard.cardID,
              tags: [],
              status: 'Owned',
              finish: 'Non-foil',
              details: {
                ...details,
              },
            };
            cards.push(fallbackCard);

            if (details.oracle_id) {
              oracleIds.push(details.oracle_id);
            }
          }
        }
      } catch (error) {
        // Skip invalid cards, log if needed
        req.logger.error(`Error processing card ${packCard.cardID}:`, error);
      }
    }

    // Note: Cards from cube already have details (Cube.getCards() calls addDetails)
    // No need to re-add details here

    if (cards.length === 0) {
      return res.status(400).json({ error: 'No valid cards found' });
    }

    // Get bot prediction for this pack using actual bot logic
    const botResult = await getBotPrediction(oracleIds);

    // Create S3 data
    const s3Data = {
      botPick: botResult.botPickIndex ?? undefined,
      botWeights: botResult.botWeights.length > 0 ? botResult.botWeights : undefined,
      cards: cards, // Card details will be stripped automatically by putS3Data
      createdByUsername: user.username,
      seed,
    };

    // Create P1P1 pack
    const pack = await p1p1PackModel.put(
      {
        cubeId: cube.id,
        createdBy: user.id,
      },
      s3Data,
    );

    return res.status(200).json({
      success: true,
      pack,
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
