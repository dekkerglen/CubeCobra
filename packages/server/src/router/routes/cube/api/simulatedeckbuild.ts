import { cardFromId, getReasonableCardByOracle, isOracleBasic } from 'serverutils/carddb';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { getBasicsFromCube } from 'serverutils/cube';
import { batchDeckbuild } from 'serverutils/draftbots';
import { cubeDao } from 'dynamo/daos';
import { CardMeta } from '@utils/datatypes/SimulationReport';

import { Request, Response } from '../../../../types/express';

/**
 * POST /cube/api/simulatedeckbuild/:id
 *
 * Builds decks for a batch of simulated draft pools using the same deckbuild
 * logic as bot seats at the end of a real draft.
 *
 * Body:   { inputs: string[][] }  — one oracle-ID array per pool
 * Response: { success: true, results: { mainboard: string[]; sideboard: string[] }[] }
 */
export const simulatedeckbuildHandler = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Must be logged in' });
  }

  const cubeId = req.params.id;
  if (!cubeId) {
    return res.status(400).json({ success: false, message: 'Cube ID required' });
  }

  const { inputs } = req.body;
  if (!Array.isArray(inputs)) {
    return res.status(400).json({ success: false, message: 'inputs must be an array' });
  }
  const MAX_INPUTS = 50 * 16; // max drafts × max seats
  if (inputs.length > MAX_INPUTS) {
    return res.status(400).json({ success: false, message: 'Too many inputs' });
  }

  try {
    const cube = await cubeDao.getById(cubeId);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found' });
    }
    if (!isCubeEditable(cube, req.user)) {
      return res.status(403).json({ success: false, message: 'Only the cube owner or collaborators can run the draft simulator' });
    }

    const cubeCards = await cubeDao.getCards(cube.id);
    const basicsBoard = cube.basicsBoard || 'Basics';
    const basicCardIds = getBasicsFromCube(cubeCards, basicsBoard, cube.basics);
    const basicsCards = basicCardIds.map((id) => cardFromId(id)).filter(Boolean);

    const maxSpells = cube.deckbuildSpells ?? 23;
    const maxLands = cube.deckbuildLands ?? 17;

    // batchDeckbuild only needs card.oracle_id — it resolves the rest via carddb internally
    const entries = (inputs as string[][]).map((oracleIds) => ({
      pool: oracleIds.map((oracle_id) => ({ oracle_id })),
      basics: basicsCards,
      maxSpells,
      maxLands,
    }));

    const results = await batchDeckbuild(entries);

    // Return metadata for basic lands so the client can display them in deck view.
    // batchDeckbuild outputs oracle IDs into mainboard; use those directly since
    // cardFromId(scryfallId).oracle_id may be empty on some CardDetails objects.
    const basicOracleIds = new Set<string>();
    for (const result of results) {
      for (const oracleId of result.mainboard) {
        if (isOracleBasic(oracleId)) basicOracleIds.add(oracleId);
      }
    }
    const basicCardMeta: Record<string, CardMeta> = {};
    for (const oracleId of basicOracleIds) {
      const card = getReasonableCardByOracle(oracleId);
      if (!card) continue;
      basicCardMeta[oracleId] = {
        name: card.name ?? oracleId,
        imageUrl: (card as any).image_normal || (card as any).image_small || '',
        colorIdentity: (card as any).color_identity ?? [],
        elo: (card as any).elo ?? 1200,
        cmc: (card as any).cmc ?? 0,
        type: (card as any).type ?? '',
      };
    }

    return res.status(200).json({ success: true, results, basicCardMeta });
  } catch (err) {
    req.logger.error(`Error in simulatedeckbuild: ${err}`, err instanceof Error ? err.stack : '');
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [simulatedeckbuildHandler],
  },
];
