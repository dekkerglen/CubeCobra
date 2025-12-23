import { draftDao } from 'dynamo/daos';
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
  const decks = await draftDao.queryByOwner(req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    decks: decks.items,
    lastKey: decks.lastKey,
  });
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ensureAuth, handler],
  },
];
