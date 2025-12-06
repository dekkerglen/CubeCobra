import Draft from 'dynamo/models/draft';
import { csrfProtection, ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).send({
      success: 'false',
      message: 'User not authenticated',
    });
  }

  const { lastKey } = req.body;
  const decks = await Draft.getByOwner(req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    decks: decks.items,
    lastKey: decks.lastEvaluatedKey,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
