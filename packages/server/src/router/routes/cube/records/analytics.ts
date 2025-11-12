import { cardOracleId } from '@utils/cardutil';
import DraftType from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';
import { RecordAnalytic } from '@utils/datatypes/RecordAnalytic';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import RecordDao from 'dynamo/models/record';
import recordAnalytic from 'dynamo/models/recordAnalytic';
import { csrfProtection, ensureAuth } from 'routes/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

function toBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: any[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

const getStandings = (record: RecordType): any => {
  const byPlayer = Object.fromEntries(
    record.players.map((player) => [
      player.name,
      {
        name: player.name,
        id: player.userId,
        matchWins: 0,
        matchLosses: 0,
        matchDraws: 0,
        gameWins: 0,
        gameLosses: 0,
        gameDraws: 0,
        trophy: record.trophy.includes(player.name),
      },
    ]),
  );

  for (const round of record.matches) {
    for (const match of round.matches) {
      const p1 = byPlayer[match.p1];
      const p2 = byPlayer[match.p2];

      if (p1) {
        p1.gameWins += match.results[0];
        p1.gameLosses += match.results[1];
        p1.gameDraws += match.results[2];
      }
      if (p2) {
        p2.gameWins += match.results[1];
        p2.gameLosses += match.results[0];
        p2.gameDraws += match.results[2];
      }

      if (match.results[0] > match.results[1]) {
        if (p1) {
          p1.matchWins += 1;
        }
        if (p2) {
          p2.matchLosses += 1;
        }
      } else if (match.results[0] < match.results[1]) {
        if (p1) {
          p1.matchLosses += 1;
        }
        if (p2) {
          p2.matchWins += 1;
        }
      } else {
        // Draw
        if (p1) {
          p1.matchDraws += 1;
        }
        if (p2) {
          p2.matchDraws += 1;
        }
      }
    }
  }

  return Object.values(byPlayer);
};

const compileAnalytics = async (records: RecordType[]): Promise<RecordAnalytic> => {
  const analytics: RecordAnalytic = {};

  const batched = toBatches(records, 20);

  for (const batch of batched) {
    const draftIds = batch.map((record) => record.draft).filter((id) => id);

    if (draftIds.length === 0) {
      continue;
    }

    const drafts = await Draft.batchGet(draftIds);
    const draftById: Record<string, DraftType> = Object.fromEntries(
      drafts.map((draft: DraftType) => [draft.id, draft]),
    );

    for (const record of batch) {
      if (!record.draft || !draftById[record.draft]) {
        continue;
      }

      const standings = getStandings(record);
      const draft = draftById[record.draft];

      if (!draft || !draft.seats || !draft.cards) {
        continue;
      }

      for (let i = 0; i < standings.length; i++) {
        const standing = standings[i];

        const seatIndex = record.players.findIndex((player) => player.name === standing.name);

        if (seatIndex === -1 || !draft.seats[seatIndex]) {
          continue;
        }

        const cardIndexes = draft.seats[seatIndex]?.mainboard?.flat(3) || [];
        const cardOracleIds = cardIndexes
          .map((index) => {
            const card = draft.cards[index];
            return card ? cardOracleId(card) : null;
          })
          .filter((id): id is string => id !== null);
        const uniqueOracleIds = [...new Set(cardOracleIds)];

        for (const oracleId of uniqueOracleIds) {
          if (!analytics[oracleId]) {
            analytics[oracleId] = {
              decks: 0,
              trophies: 0,
              matchWins: 0,
              matchLosses: 0,
              gameLosses: 0,
              gameWins: 0,
              gameDraws: 0,
              matchDraws: 0,
            };
          }

          analytics[oracleId].decks += 1;

          if (standing.trophy) {
            analytics[oracleId].trophies += 1;
          }

          analytics[oracleId].matchWins += standing.matchWins;
          analytics[oracleId].matchLosses += standing.matchLosses;
          analytics[oracleId].matchDraws += standing.matchDraws;
          analytics[oracleId].gameWins += standing.gameWins;
          analytics[oracleId].gameLosses += standing.gameLosses;
          analytics[oracleId].gameDraws += standing.gameDraws;
        }
      }
    }
  }

  return analytics;
};

export const compileAnalyticsHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to compile analytics for this cube');
      return redirect(req, res, `/cube/records/${cube.id}?tab=2`);
    }

    const records: RecordType[] = [];
    let lastKey: any = undefined;

    do {
      const result = await RecordDao.getByCube(cube.id, 1000, lastKey);

      if (!result || !result.items) {
        break;
      }

      records.push(...result.items);
      lastKey = result.lastKey;
    } while (lastKey);

    const analyticsData = await compileAnalytics(records);

    await recordAnalytic.put(cube.id, analyticsData);

    req.flash('success', 'Analytics compiled successfully');
    return redirect(req, res, `/cube/records/${cube.id}?tab=2`);
  } catch (error) {
    handleRouteError(req, res, error, `/cube/records/${req.params.id}?tab=2`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, compileAnalyticsHandler],
  },
];
