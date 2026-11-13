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

const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
};

const listColors = (list: ResolvedList): string[] =>
  assessColors(
    list.cards.map((card) => {
      const details = list.details.get(card.oracle);
      return { isLand: (details?.type ?? '').includes('Land'), colorIdentity: details?.color_identity ?? [] };
    }),
  );

/**
 * The encoder's 128-dimension embedding of a list, its archetypes ranked the way drafts name decks
 * (by share of the list's archetype topics), and, given a second list, how alike the two
 * embeddings are.
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
        // Archetypes read the pasted cards themselves, not the model's stand-ins.
        const oracles = list.cards
          .filter((card) => !ignoreBasics || !isBasicLand(list.details.get(card.oracle)))
          .map((card) => card.oracle);
        const archetypes = await rankArchetypesForOracles(oracles);
        return { list: summarize(list), embedding, colors: listColors(list), archetypes };
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
