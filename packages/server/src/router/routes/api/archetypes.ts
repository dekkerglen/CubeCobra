import Joi from 'joi';
import { classifyDecks } from 'serverutils/archetype';
import { jsonLimiter } from 'serverutils/rateLimiters';

import { NextFunction, Request, Response } from '../../../types/express';

// The draft simulator and the record and playtest analyses send their pools in chunks of this size.
const MAX_POOLS = 200;
const MAX_POOL_CARDS = 250;

const ClassifyBodySchema = Joi.object({
  pools: Joi.array()
    .items(Joi.array().items(Joi.string().max(64)).max(MAX_POOL_CARDS))
    .max(MAX_POOLS)
    .required(),
});

const validateClassifyBody = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = ClassifyBodySchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    return;
  }
  next();
};

/**
 * POST /api/archetypes/classify
 *
 * Body: { pools: string[][] } (oracle ids per pool). Returns { labels }: each pool's archetype as
 * drafts name decks, or null when it can't be named.
 */
const classifyHandler = async (req: Request, res: Response) => {
  const { pools } = req.body as { pools: string[][] };
  const labels = await classifyDecks(pools.map((pool) => [...new Set(pool)]));
  return res.status(200).json({ labels });
};

export const routes = [
  {
    method: 'post',
    path: '/classify',
    handler: [jsonLimiter(60_000, 60), validateClassifyBody, classifyHandler],
  },
];
