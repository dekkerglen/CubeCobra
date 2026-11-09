import { assessColors } from '@utils/drafting/assessColors';
import { type DeckbuildMlFns, runBatchDeckbuild } from '@utils/drafting/deckbuildCore';
import { rankArchetypesForEmbedding } from 'serverutils/archetype';
import { getMostReasonable } from 'serverutils/carddb';
import { computeDeckbuildFacts } from 'serverutils/deckbuildFacts';
import {
  isBasicLand,
  ListInputError,
  playgroundPrinting,
  ratePastedCards,
  resolveList,
  sendPlaygroundError,
  summarize,
} from 'serverutils/mlPlayground';
import { batchBuildOrThrow, batchDraftOrThrow, batchEncodeOrThrow } from 'serverutils/ml';
import { jsonLimiter } from 'serverutils/rateLimiters';

import { Request, Response } from '../../../../../types/express';

const MAX_POOL_CARDS = 500;
const BASIC_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

/**
 * The bot deckbuilder on a pasted pool: the same algorithm bots use to build their decks after a
 * draft (seed with the deck_build_decoder, fill with the draft_decoder, trim the manabase, add
 * basics). Also returns the deck_build_decoder's rating for every pool card, and the deck's colors
 * and archetype as a draft would name the seat.
 *
 * Body: { pool, spells?, lands?, substitute? }
 *   substitute - give the model stand-ins for cards it doesn't know. On by default, as for bots.
 */
export const deckbuildHandler = async (req: Request, res: Response) => {
  try {
    const substitute = req.body.substitute !== false;
    const maxSpells = clampInt(req.body.spells, 23, 1, 100);
    const maxLands = clampInt(req.body.lands, 17, 0, 60);
    const printing = playgroundPrinting(req);
    const pool = resolveList(req.body.pool, { substitute, printing });

    const poolOracles = pool.cards.flatMap((card) => Array<string>(card.count).fill(card.oracle));
    if (poolOracles.length === 0) {
      throw new ListInputError('The pool has no cards.');
    }
    if (poolOracles.length > MAX_POOL_CARDS) {
      throw new ListInputError(`A pool can have at most ${MAX_POOL_CARDS} cards.`);
    }

    const basics = BASIC_NAMES.map((name) => getMostReasonable(name, printing)).filter(
      (card): card is NonNullable<typeof card> => !!card && !card.error,
    );
    const basicsOracles = basics.map((card) => card.oracle_id);

    const facts = computeDeckbuildFacts([...poolOracles, ...basicsOracles]);
    for (const oracle of Object.keys(facts)) {
      facts[oracle]!.mlOracle = pool.toMl[oracle] ?? oracle;
    }

    // The deck_build_decoder's ratings for the pool are the first thing the build asks for;
    // keep them to show alongside the deck.
    let buildRatings: { oracle: string; rating: number }[] = [];
    const ml: DeckbuildMlFns = {
      batchBuild: async (inputs) => {
        const results = await batchBuildOrThrow(inputs);
        buildRatings = results[0] ?? [];
        return results;
      },
      batchDraft: (inputs) => batchDraftOrThrow(inputs),
    };

    const [deck] = await runBatchDeckbuild([{ poolOracles, basicsOracles, maxSpells, maxLands }], facts, ml);
    const mainboard = deck?.mainboard ?? [];
    const sideboard = deck?.sideboard ?? [];

    const deckCard: Record<string, { cardID: string; name: string }> = {};
    for (const card of basics) deckCard[card.oracle_id] = { cardID: card.scryfall_id, name: card.name };
    for (const card of pool.cards) deckCard[card.oracle] = { cardID: card.cardID, name: card.name };
    const toDeckCards = (oracles: string[]) =>
      oracles.flatMap((oracle) => (deckCard[oracle] ? [deckCard[oracle]] : []));

    const colors = assessColors(
      mainboard.map((oracle) => ({
        isLand: facts[oracle]?.isLand ?? false,
        colorIdentity: facts[oracle]?.colorIdentity ?? [],
      })),
    );

    // Named the way a draft names a bot seat. Basics are left out, as they were for the decks
    // the archetypes were found in.
    let archetype: string | null = null;
    const deckModelOracles = [
      ...new Set(
        mainboard
          .filter((oracle) => !isBasicLand(pool.details.get(oracle)) && !basicsOracles.includes(oracle))
          .map((oracle) => facts[oracle]?.mlOracle ?? oracle),
      ),
    ];
    if (deckModelOracles.length > 0) {
      try {
        const [embedding] = await batchEncodeOrThrow([deckModelOracles]);
        archetype = rankArchetypesForEmbedding(embedding ?? [])[0]?.label ?? null;
      } catch {
        archetype = null;
      }
    }

    return res.status(200).json({
      success: true,
      pool: summarize(pool),
      buildRatings: ratePastedCards(pool, buildRatings),
      mainboard: toDeckCards(mainboard),
      sideboard: toDeckCards(sideboard),
      colors,
      archetype,
    });
  } catch (err) {
    return sendPlaygroundError(req, res, err, 'ML Playground deckbuild');
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    // One build makes a model call per card it adds, so it costs far more than the other modes.
    handler: [jsonLimiter(60_000, 12), deckbuildHandler],
  },
];
