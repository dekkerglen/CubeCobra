// TODO(otags): when otag/atag support is restored, re-add `import catalog from 'serverutils/cardCatalog'`
// and restore the oracle tag lookup in buildCardMeta:
//   const oracleIndex = catalog.oracleToIndex[oracleId];
//   const tagIndices = oracleIndex !== undefined ? catalog.oracleTagDict[oracleIndex] : undefined;
//   oracleTags: tagIndices?.length ? tagIndices.map(i => catalog.oracleTagNames[i]).filter(Boolean) : undefined,
import { isManaFixingLand } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { BasicLandInfo, CardMeta, SimulationSetupResponse } from '@utils/datatypes/SimulationReport';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { cubeDao } from 'dynamo/daos';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { cardFromId, getOracleForMl } from 'serverutils/carddb';
import { getBasicsFromCube } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { userOrIpKey } from 'serverutils/rateLimitKeys';
import { MAX_SEATS } from 'serverutils/simulatorConstants';

import { NextFunction, Request, Response } from '../../../../types/express';

// 8 setup calls per 30 minutes per user — allows retries but prevents hammering
// the CPU-expensive pack generation step.
const setupLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 8,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({
      success: false,
      message: 'Too many simulation requests. Please wait before starting another simulation.',
    });
  },
});

const SetupSchema = Joi.object({
  numDrafts: Joi.number().integer().min(1).max(1000).default(100),
  numSeats: Joi.number().integer().min(2).max(MAX_SEATS).default(8),
  formatId: Joi.number().integer().min(-1).default(-1),
});

export const simulatesetupHandler = async (req: Request, res: Response) => {
  try {
    if (typeof req.setTimeout === 'function') req.setTimeout(5 * 60 * 1000);
    if (typeof res.setTimeout === 'function') res.setTimeout(5 * 60 * 1000);

    const cubeId = req.params.id;
    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }

    const { error, value } = SetupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const { numDrafts, numSeats, formatId } = value;

    const cubeCards = await cubeDao.getCards(cube.id);
    const boardCards: Record<string, Card[]> = {};
    for (const [key, cards] of Object.entries(cubeCards)) {
      if (key !== 'id' && Array.isArray(cards)) {
        boardCards[key] = cards as Card[];
      }
    }

    const resolvedFormatId = formatId ?? (cube.defaultFormat === undefined ? -1 : cube.defaultFormat);
    const format = getDraftFormat({ id: resolvedFormatId, packs: 3, players: numSeats, cards: 15 }, cube);

    // Generate initial packs for all N drafts
    const initialPacks: string[][][][] = [];
    let packSteps: { action: string; amount?: number | null }[][] | null = null;
    const cardMeta: Record<string, CardMeta> = {};

    for (let i = 0; i < numDrafts; i++) {
      let draft;
      try {
        draft = createDraft(cube, format, boardCards, numSeats, undefined, `draftsim-setup-${i}-${Date.now()}`);
      } catch {
        // Not enough cards — return an error
        return res
          .status(400)
          .json({ success: false, message: 'Not enough cards in cube to run a draft with these settings' });
      }

      const { InitialState, cards } = draft;
      if (!InitialState || InitialState.length === 0) {
        return res.status(400).json({ success: false, message: 'Failed to generate draft packs' });
      }

      const numPacks = InitialState[0]?.length ?? 0;

      // Extract pack steps once (same for all drafts)
      if (packSteps === null) {
        packSteps = Array.from({ length: numPacks }, (_, p) =>
          (InitialState[0]?.[p]?.steps ?? []).map((s) => ({ action: s.action, amount: s.amount ?? null })),
        );
      }

      // Extract initial pack contents as oracle IDs
      const draftPacks: string[][][] = Array.from({ length: numSeats }, (_, s) =>
        Array.from({ length: numPacks }, (_, p) =>
          (InitialState[s]?.[p]?.cards ?? [])
            .map((idx) => cards[idx]?.details?.oracle_id)
            .filter((o): o is string => !!o),
        ),
      );
      initialPacks.push(draftPacks);

      // Collect card metadata, unioning tags across all instances of the same oracle_id
      for (const card of cards) {
        if (!card?.details?.oracle_id) continue;
        const details = card.details;
        const oracleId = details.oracle_id;
        if (!cardMeta[oracleId]) {
          const mlOracleId = getOracleForMl(oracleId, null);
          cardMeta[oracleId] = {
            name: details.name ?? oracleId,
            imageUrl: card.imgUrl || details.image_normal || details.image_small || '',
            colorIdentity: details.color_identity ?? [],
            elo: details.elo ?? 1200,
            cmc: details.cmc ?? 0,
            type: details.type ?? '',
            producedMana: details.produced_mana ?? [],
            parsedCost: details.parsed_cost ?? [],
            mlOracleId: mlOracleId !== oracleId ? mlOracleId : undefined,
            tags: card.tags && card.tags.length > 0 ? [...card.tags] : undefined,
            isManaFixingLand: isManaFixingLand(details) || undefined,
          };
        } else if (card.tags && card.tags.length > 0) {
          // Union tags from additional instances of the same oracle_id
          const existing = new Set(cardMeta[oracleId].tags ?? []);
          for (const tag of card.tags) existing.add(tag);
          cardMeta[oracleId].tags = [...existing];
        }
      }
    }

    // Build basics list for client-side deckbuilding
    const basicsBoard = cube.basicsBoard || 'Basics';
    const basicCardIds = getBasicsFromCube(cubeCards, basicsBoard, cube.basics);
    const basics: BasicLandInfo[] = [];
    for (const id of basicCardIds) {
      const details = cardFromId(id);
      if (!details || !details.oracle_id) continue;
      basics.push({
        oracleId: details.oracle_id,
        name: details.name ?? details.oracle_id,
        imageUrl: details.image_normal || details.image_small || '',
        colorIdentity: details.color_identity ?? [],
        producedMana: details.produced_mana ?? [],
        type: details.type ?? '',
      });
    }

    const response: SimulationSetupResponse = {
      cubeId: cube.id,
      initialPacks,
      packSteps: packSteps ?? [],
      cardMeta,
      cubeName: cube.name,
      numSeats,
      basics,
    };

    return res.status(200).json({ success: true, ...response });
  } catch (err) {
    req.logger.error(`Error in simulatesetup: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [setupLimiter, simulatesetupHandler],
  },
];
