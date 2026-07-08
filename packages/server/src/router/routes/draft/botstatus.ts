import { draftDao } from 'dynamo/daos';

import { Request, Response } from '../../../types/express';

/**
 * GET /draft/botstatus/:id
 *
 * Lightweight status check the client polls after finishing/publishing a draft: reports
 * whether the async bot-deckbuild Lambda has finished building this draft's bot decks.
 * `pending: true` while the Lambda still owes ML-built decks (bot seats show a naive
 * layout until then); `pending: false` once they're ready.
 */
export const handler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    return res.status(400).json({ error: 'Draft ID is required' });
  }

  const draft = await draftDao.getById(req.params.id);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }

  return res.status(200).json({ pending: !!draft.botDecksPending, failed: !!draft.botDecksFailed });
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [handler],
  },
];
