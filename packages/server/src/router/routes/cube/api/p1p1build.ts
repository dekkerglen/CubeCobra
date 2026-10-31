import { cardName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { cubeDao } from 'dynamo/daos';
import Joi from 'joi';
import _ from 'lodash';
import { bodyValidation, csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable, scoreP1P1Packs } from 'serverutils/cubefn';
import { jsonLimiter } from 'serverutils/rateLimiters';

import { Request, Response } from '../../../../types/express';

// Tough fills try this many random fills and keep the one whose best card is rated lowest,
// the same trade-off generateBalancedPack makes for whole packs.
const TOUGH_FILL_CANDIDATES = 10;

const MAX_P1P1_PACK_SIZE = 30;

const P1P1BuildSchema = Joi.object({
  slots: Joi.array()
    .items(
      Joi.alternatives()
        .try(
          Joi.object({
            cardID: Joi.string().required(),
            index: Joi.number().integer().min(0).required(),
          }),
          // A card picked by name; resolved to a mainboard copy that isn't already in the pack.
          Joi.object({ name: Joi.string().max(200).required() }),
        )
        .allow(null),
    )
    .min(1)
    .max(MAX_P1P1_PACK_SIZE)
    .required(),
  // score: rate the filled slots and leave empty ones empty
  // random / tough: fill every empty slot from the mainboard, then rate the whole pack
  mode: Joi.string().valid('score', 'random', 'tough').required(),
});

type Slot = { cardID: string; index: number } | { name: string } | null;

/**
 * Finds a pack card in the cube. Packs generated from a custom format can draw from custom
 * boards, so every board but the maybeboard counts. `index` is per-board, so it is matched
 * together with cardID.
 */
const findPackCard = (boards: Record<string, Card[]>, slot: { cardID: string; index: number }) => {
  for (const [board, list] of Object.entries(boards)) {
    if (board === 'maybeboard') continue;
    const card = list.find((c) => c.index === slot.index && c.cardID === slot.cardID);
    if (card) return card;
  }
  return undefined;
};

const cubeBoards = (cubeCards: Record<string, unknown>): Record<string, Card[]> => {
  const boards: Record<string, Card[]> = {};
  for (const [board, list] of Object.entries(cubeCards)) {
    if (board !== 'id' && Array.isArray(list)) {
      boards[board] = list as Card[];
    }
  }
  return boards;
};

export const p1p1BuildHandler = async (req: Request, res: Response) => {
  try {
    const { slots, mode } = req.body as { slots: Slot[]; mode: 'score' | 'random' | 'tough' };

    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ error: 'Cube not found' });
    }

    const boards = cubeBoards(await cubeDao.getCards(cube.id));

    const placed: (Card | null)[] = [];
    // Resolve explicit cards first so a by-name pick never takes a copy the pack already uses.
    for (const slot of slots) {
      if (!slot || 'name' in slot) {
        placed.push(null);
        continue;
      }
      const card = findPackCard(boards, slot);
      if (!card) {
        return res.status(400).json({ error: `Card ${slot.cardID} is not in this cube` });
      }
      placed.push(card);
    }
    for (const [i, slot] of slots.entries()) {
      if (!slot || !('name' in slot)) continue;
      const target = slot.name.trim().toLowerCase();
      const card = (boards.mainboard || []).find((c) => cardName(c).toLowerCase() === target && !placed.includes(c));
      if (!card) {
        return res.status(400).json({ error: `No unused copy of ${slot.name} in this cube's mainboard` });
      }
      placed[i] = card;
    }

    const emptyCount = placed.filter((card) => card === null).length;
    let candidates: (Card | null)[][] = [placed];

    if (mode !== 'score' && emptyCount > 0) {
      const used = new Set(placed.filter((card): card is Card => card !== null));
      const pool = (boards.mainboard || []).filter((card) => !used.has(card));
      if (pool.length < emptyCount) {
        return res.status(400).json({ error: 'Not enough cards in the mainboard to fill the pack' });
      }

      const candidateCount = mode === 'tough' ? TOUGH_FILL_CANDIDATES : 1;
      candidates = _.times(candidateCount, () => {
        const fill = _.sampleSize(pool, emptyCount);
        return placed.map((card) => card ?? fill.pop()!);
      });
    }

    // Only filled slots go to the model; ratings are mapped back to slot positions after.
    const filled = candidates.map((pack) => pack.flatMap((card, i) => (card ? [i] : [])));
    const scores = await scoreP1P1Packs(
      candidates.map((pack, c) => filled[c]!.map((i) => pack[i]!.details?.oracle_id ?? '')),
    );

    let best = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i]!.maxBotWeight < scores[best]!.maxBotWeight) best = i;
    }

    const pack = candidates[best]!;
    const { botPickIndex, botWeights } = scores[best]!;
    // Empty slots have no rating; report null rather than a 0 that reads like a real score.
    const weights: (number | null)[] = pack.map(() => null);
    filled[best]!.forEach((slotIndex, i) => {
      weights[slotIndex] = botWeights[i] ?? 0;
    });

    return res.status(200).json({
      cards: pack,
      botWeights: weights,
      botPick: botPickIndex === null ? null : filled[best]![botPickIndex],
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error building pack' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    // Every call runs the draft model, and tough fills run it on several candidates.
    handler: [ensureAuth, jsonLimiter(60_000, 30), csrfProtection, bodyValidation(P1P1BuildSchema), p1p1BuildHandler],
  },
];
