import Card from '@utils/datatypes/Card';
import { CardMeta, SimulationSetupResponse } from '@utils/datatypes/SimulationReport';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { cubeDao } from 'dynamo/daos';
import Joi from 'joi';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';


const MAX_DRAFTS = 50;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const SetupSchema = Joi.object({
  numDrafts: Joi.number().integer().min(1).max(MAX_DRAFTS).default(50),
  numSeats: Joi.number().integer().min(2).max(16).default(8),
});

export const simulatesetupHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const cubeId = req.params.id;
    if (!cubeId) {
      return res.status(400).json({ success: false, message: 'Cube ID required' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }

    if (!isCubeEditable(cube, req.user)) {
      return res.status(403).json({ success: false, message: 'Only the cube owner or collaborators can run the draft simulator' });
    }

    if (cube.lastDraftSimulation && Date.now() - cube.lastDraftSimulation < COOLDOWN_MS) {
      const msRemaining = COOLDOWN_MS - (Date.now() - cube.lastDraftSimulation);
      const hoursRemaining = Math.ceil(msRemaining / 3600000);
      return res.status(429).json({ success: false, message: `Simulation cooldown active — next run available in ${hoursRemaining}h`, hoursRemaining });
    }

    const { error, value } = SetupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const { numDrafts, numSeats } = value;

    const cubeCards = await cubeDao.getCards(cube.id);
    const boardCards: Record<string, Card[]> = {};
    for (const [key, cards] of Object.entries(cubeCards)) {
      if (key !== 'id' && Array.isArray(cards)) {
        boardCards[key] = cards as Card[];
      }
    }

    const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
    const format = getDraftFormat({ id: formatId, packs: 3, players: numSeats, cards: 15 }, cube);

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
        return res.status(400).json({ success: false, message: 'Not enough cards in cube to run a draft with these settings' });
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

      // Collect card metadata (only needs to be done once per oracle_id)
      for (const card of cards) {
        if (!card?.details?.oracle_id || cardMeta[card.details.oracle_id]) continue;
        const details = card.details;
        cardMeta[details.oracle_id] = {
          name: details.name ?? details.oracle_id,
          imageUrl: details.image_normal || details.image_small || '',
          colorIdentity: details.color_identity ?? [],
          elo: details.elo ?? 1200,
          cmc: details.cmc ?? 0,
          type: details.type ?? '',
        };
      }
    }

    const response: SimulationSetupResponse = {
      cubeId: cube.id,
      initialPacks,
      packSteps: packSteps ?? [],
      cardMeta,
      cubeName: cube.name,
      numSeats,
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
    handler: [simulatesetupHandler],
  },
];
