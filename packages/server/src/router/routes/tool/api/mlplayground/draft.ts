import {
  ListInputError,
  modelOracles,
  playgroundPrinting,
  ratePastedCards,
  resolveList,
  sendPlaygroundError,
  summarize,
} from 'serverutils/mlPlayground';
import { draftOrThrow } from 'serverutils/ml';
import { jsonLimiter } from 'serverutils/rateLimiters';

import { Request, Response } from '../../../../../types/express';

// Same bounds as the public draftbot API.
const MAX_PACK_CARDS = 1000;
const MAX_POOL_CARDS = 500;

/**
 * A draft bot's pick: the draft_decoder's softmax over the pack's cards, given the pool.
 *
 * Body: { pack, pool?, substitute? }
 *   substitute - give the model stand-ins for cards it doesn't know. On by default, as for the
 *                bots in a real draft.
 */
export const draftHandler = async (req: Request, res: Response) => {
  try {
    const substitute = req.body.substitute !== false;
    const printing = playgroundPrinting(req);
    const pack = resolveList(req.body.pack, { substitute, printing });
    const pool = resolveList(req.body.pool, { substitute, printing });

    if (pack.cards.length === 0) {
      throw new ListInputError('The pack has no cards.');
    }
    if (pack.cards.length > MAX_PACK_CARDS) {
      throw new ListInputError(`A pack can have at most ${MAX_PACK_CARDS} cards.`);
    }
    if (pool.cards.reduce((sum, card) => sum + card.count, 0) > MAX_POOL_CARDS) {
      throw new ListInputError(`A pool can have at most ${MAX_POOL_CARDS} cards.`);
    }

    const ratings = await draftOrThrow(modelOracles(pack), modelOracles(pool));

    return res.status(200).json({
      success: true,
      pack: summarize(pack),
      pool: summarize(pool),
      picks: ratePastedCards(pack, ratings),
    });
  } catch (err) {
    return sendPlaygroundError(req, res, err, 'ML Playground draft');
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [jsonLimiter(60_000, 60), draftHandler],
  },
];
