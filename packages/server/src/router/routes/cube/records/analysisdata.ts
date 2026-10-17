import { cardCmc, cardColorIdentity, cardElo, cardImageUrl, cardName, cardOracleId, cardType } from '@utils/cardutil';
import DraftType from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';
import { changelogDao, cubeDao, draftDao, recordDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';
import { buildMainboardHistory, MainboardHistory } from 'serverutils/mainboardHistory';

import { Request, Response } from '../../../../types/express';

function toBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// One record's raw inputs for client-side analysis: its metadata + each player's
// deck as oracle ids. The client computes ALL aggregates (win rates, synergies,
// matchups, Elo, archetype clustering) from this — nothing is precomputed here.
interface AnalysisRecord {
  id: string;
  name: string;
  date: number;
  players: { name: string; userId?: string }[];
  matches: { matches: { p1: string; p2: string; results: number[] }[] }[];
  trophy: string[];
  // mainboard oracle ids per player name
  decks: { [playerName: string]: string[] };
}

// Per-oracle card info for every card that appears in any deck — lets the client
// render decks/charts even for cards no longer in the live cube.
interface CardInfo {
  cardID: string;
  name: string;
  imageUrl: string;
  type: string;
  cmc: number;
  colorIdentity: string[];
  elo: number;
}

export const analysisDataHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', message: 'Cube not found' });
    }

    // All records for the cube.
    const records: RecordType[] = [];
    let lastKey: any = undefined;
    do {
      const result = await recordDao.getByCube(cube.id, 1000, lastKey);
      if (!result || !result.items) break;
      records.push(...result.items);
      lastKey = result.lastKey;
    } while (lastKey);

    const out: AnalysisRecord[] = [];
    const cards: Record<string, CardInfo> = {};

    for (const batch of toBatches(records, 20)) {
      const draftIds = batch.map((record) => record.draft).filter((id): id is string => !!id);
      const draftById: Record<string, DraftType> = {};
      if (draftIds.length > 0) {
        const drafts = await draftDao.batchGet(draftIds);
        for (const draft of drafts as DraftType[]) draftById[draft.id] = draft;
      }

      for (const record of batch) {
        const decks: { [playerName: string]: string[] } = {};
        const draft = record.draft ? draftById[record.draft] : undefined;
        if (draft && draft.seats && draft.cards) {
          for (let i = 0; i < record.players.length; i++) {
            const player = record.players[i];
            const seat = draft.seats[i];
            if (!player || !seat) continue;
            const oracles = (seat.mainboard?.flat(3) || [])
              .map((index) => {
                const card = draft.cards[index];
                if (!card) return null;
                const oracle = cardOracleId(card);
                if (oracle && !cards[oracle]) {
                  cards[oracle] = {
                    cardID: card.cardID,
                    name: cardName(card),
                    imageUrl: cardImageUrl(card) || '',
                    type: cardType(card) || '',
                    cmc: cardCmc(card) || 0,
                    colorIdentity: cardColorIdentity(card) || [],
                    elo: cardElo(card),
                  };
                }
                return oracle;
              })
              .filter((id): id is string => id !== null);
            if (oracles.length > 0) decks[player.name] = [...new Set(oracles)];
          }
        }

        out.push({
          id: record.id,
          name: record.name,
          date: record.date,
          players: record.players.map((p) => ({ name: p.name, userId: p.userId })),
          matches: record.matches ?? [],
          trophy: record.trophy ?? [],
          decks,
        });
      }
    }

    // When each card was in the mainboard, so the client can tell which events a
    // card was available in. Best-effort: without it the client hides play rate.
    let cubeHistory: MainboardHistory | undefined;
    if (out.length > 0) {
      try {
        const minDate = Math.min(...out.map((record) => record.date));
        const cubeCards = await cubeDao.getCards(cube.id);
        cubeHistory = await buildMainboardHistory(cube.id, cubeCards.mainboard ?? [], minDate, changelogDao);
      } catch (err) {
        const error = err as Error;
        req.logger.error(`Error building mainboard history: ${error.message}`, error.stack);
      }
    }

    return res.status(200).send({ success: 'true', records: out, cards, cubeHistory });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', message: 'Error loading analysis data' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [analysisDataHandler],
  },
];
