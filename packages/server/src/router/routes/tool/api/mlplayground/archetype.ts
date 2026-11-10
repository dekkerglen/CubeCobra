import { cosineSimilarity } from '@utils/drafting/archetype';
import { assessColors } from '@utils/drafting/assessColors';
import { rankArchetypesForOracles } from 'serverutils/archetype';
import {
  isBasicLand,
  ListInputError,
  modelOracles,
  playgroundPrinting,
  type ResolvedList,
  resolveList,
  sendPlaygroundError,
  summarize,
} from 'serverutils/mlPlayground';
import { batchEncodeOrThrow } from 'serverutils/ml';
import { jsonLimiter } from 'serverutils/rateLimiters';

import { Request, Response } from '../../../../../types/express';

const listColors = (list: ResolvedList): string[] =>
  assessColors(
    list.cards.map((card) => {
      const details = list.details.get(card.oracle);
      return { isLand: (details?.type ?? '').includes('Land'), colorIdentity: details?.color_identity ?? [] };
    }),
  );

/**
 * The encoder's 128-dimension embedding of a list, its archetypes ranked the way drafts name decks
 * (by share of the list's archetype topics, or for the legacy model by closest cluster center),
 * and, given a second list, how alike the two embeddings are.
 *
 * Body: { cards, compare?, substitute?, ignoreBasics? }
 *   substitute   - give the model stand-ins for cards it doesn't know. Off by default: drafts
 *                  name decks from their cards as they are.
 *   ignoreBasics - leave basic lands out, as they were for the decks the archetypes were found
 *                  in. On by default.
 */
export const archetypeHandler = async (req: Request, res: Response) => {
  try {
    const substitute = req.body.substitute === true;
    const ignoreBasics = req.body.ignoreBasics !== false;
    const printing = playgroundPrinting(req);

    const lists = [resolveList(req.body.cards, { substitute, printing })];
    const compareText = req.body.compare;
    if (typeof compareText === 'string' && compareText.trim().length > 0) {
      lists.push(resolveList(compareText, { substitute, printing }));
    }
    if (lists[0]!.cards.length === 0) {
      throw new ListInputError('The list has no cards.');
    }

    const inputs = lists.map((list) =>
      modelOracles(list, (card) => !ignoreBasics || !isBasicLand(list.details.get(card.oracle))),
    );
    const embeddings = await batchEncodeOrThrow(inputs);

    const results = await Promise.all(
      lists.map(async (list, index) => {
        const embedding = embeddings[index] ?? [];
        // Topics read the pasted cards themselves; the legacy centers read the encoder's embedding.
        const oracles = list.cards
          .filter((card) => !ignoreBasics || !isBasicLand(list.details.get(card.oracle)))
          .map((card) => card.oracle);
        const { scoreKind, archetypes } = await rankArchetypesForOracles(oracles, async () => embedding);
        return { list: summarize(list), embedding, colors: listColors(list), scoreKind, archetypes };
      }),
    );

    const [first, second] = results;
    const similarity =
      second && first!.embedding.length > 0 && second.embedding.length > 0
        ? cosineSimilarity(first!.embedding, second.embedding)
        : null;

    return res.status(200).json({ success: true, results, similarity });
  } catch (err) {
    return sendPlaygroundError(req, res, err, 'ML Playground archetype');
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [jsonLimiter(60_000, 60), archetypeHandler],
  },
];
