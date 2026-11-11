import { Match } from '@utils/datatypes/Record';
import { BYE, UNKNOWN_OPPONENT } from '@utils/records/pairings';
import { isSelfPairing } from '@utils/records/roundChecks';
import { RecordEntity } from 'dynamo/dao/RecordDynamoDao';
import { cubeDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureAuthJson } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../../types/express';

const matchSchema = Joi.object({
  p1: Joi.string().required(),
  p2: Joi.string().required(),
  results: Joi.array().items(Joi.number().integer().min(0)).length(3).required(),
}).unknown(false);

// Who the client last saw in a match, so an edit made from a screen that's out of date (another
// device removed a match or a round since, shifting the rest) is refused instead of landing on
// whichever match now holds that position.
const expectedSchema = Joi.object({
  p1: Joi.string().required(),
  p2: Joi.string().required(),
}).unknown(false);

export const setMatchSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
  matchIndex: Joi.number().integer().min(0).required(),
  match: matchSchema.required(),
  expected: expectedSchema.optional(),
}).unknown(false);

export const addMatchSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
  // How many rounds the client sees, so a removed round can't shift a new match into the wrong one.
  expectedRounds: Joi.number().integer().min(0).optional(),
}).unknown(false);

export const removeMatchSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
  matchIndex: Joi.number().integer().min(0).required(),
  expected: expectedSchema.optional(),
}).unknown(false);

// The record's rounds changed under the client: refused with every round as stored, which the
// client shows in place of its own so the next edit starts from the truth.
const conflict = (res: Response, record: RecordEntity) =>
  res.status(409).json({
    success: 'false',
    conflict: 'true',
    message:
      'This round was changed somewhere else. The latest version is shown; make your change again if it still applies.',
    rounds: record.matches || [],
  });

const matchesExpected = (match: Match | undefined, expected?: { p1: string; p2: string }) =>
  !expected || (match !== undefined && match.p1 === expected.p1 && match.p2 === expected.p2);

// Shared by all three handlers below: record exists, its cube exists and is viewable, and the
// requesting user can edit it. Sends the matching error response itself and returns undefined
// on failure, so a handler can bail out with a single `if (!record) return;`.
const loadRecordForEdit = async (req: Request, res: Response): Promise<RecordEntity | undefined> => {
  const record = req.params.id ? await recordDao.getById(req.params.id) : undefined;
  if (!record) {
    res.status(404).json({ success: 'false', message: 'Record not found' });
    return undefined;
  }

  const cube = await cubeDao.getById(record.cube);
  if (!cube || !isCubeViewable(cube, req.user)) {
    res.status(404).json({ success: 'false', message: 'Cube not found' });
    return undefined;
  }

  if (!isCubeEditable(cube, req.user)) {
    res.status(403).json({ success: 'false', message: 'You do not have permission to edit a record for this cube' });
    return undefined;
  }

  return record;
};

export const setMatchHandler = async (req: Request, res: Response) => {
  try {
    const record = await loadRecordForEdit(req, res);
    if (!record) {
      return;
    }

    const { roundIndex, matchIndex, match, expected } = req.body as {
      roundIndex: number;
      matchIndex: number;
      match: Match;
      expected?: { p1: string; p2: string };
    };

    record.matches = record.matches || [];
    const round = record.matches[roundIndex];
    if (!round || matchIndex >= round.matches.length) {
      if (expected) {
        return conflict(res, record);
      }
      return res.status(400).json({ success: 'false', message: round ? 'Invalid match index' : 'Invalid round index' });
    }
    if (!matchesExpected(round.matches[matchIndex], expected)) {
      return conflict(res, record);
    }

    if (isSelfPairing(match)) {
      return res.status(400).json({ success: 'false', message: `${match.p1} can't play against themselves.` });
    }
    // A side may name a player of the event, a placeholder, or whoever it already named (a
    // record can hold a match for someone since removed); anything else is a name from a
    // screen that missed a rename, and would make a player nobody is.
    const current = round.matches[matchIndex]!;
    const listed = new Set([
      ...record.players.map((player) => player.name),
      BYE,
      UNKNOWN_OPPONENT,
      current.p1,
      current.p2,
    ]);
    const stranger = [match.p1, match.p2].find((name) => !listed.has(name));
    if (stranger) {
      return expected
        ? conflict(res, record)
        : res.status(400).json({ success: 'false', message: `${stranger} isn't a player in this event.` });
    }

    round.matches[matchIndex] = match;
    record.dateLastUpdated = Date.now();

    await recordDao.update(record);

    return res.status(200).json({ success: 'true', round });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error updating record' });
  }
};

export const addMatchHandler = async (req: Request, res: Response) => {
  try {
    const record = await loadRecordForEdit(req, res);
    if (!record) {
      return;
    }

    const { roundIndex, expectedRounds } = req.body as { roundIndex: number; expectedRounds?: number };

    record.matches = record.matches || [];
    if (expectedRounds !== undefined && expectedRounds !== record.matches.length) {
      return conflict(res, record);
    }
    const round = record.matches[roundIndex];
    if (!round) {
      return res.status(400).json({ success: 'false', message: 'Invalid round index' });
    }

    // Matches EditMatchRound.emptyMatch() on the client (not importable here, since the
    // server must not depend on the client package), so a round opened from this endpoint
    // starts identically to one opened in the transcription workspace.
    round.matches.push({ p1: 'Unknown Opponent', p2: 'Unknown Opponent', results: [0, 0, 0] });
    record.dateLastUpdated = Date.now();

    await recordDao.update(record);

    return res.status(200).json({ success: 'true', round });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error updating record' });
  }
};

export const removeMatchHandler = async (req: Request, res: Response) => {
  try {
    const record = await loadRecordForEdit(req, res);
    if (!record) {
      return;
    }

    const { roundIndex, matchIndex, expected } = req.body as {
      roundIndex: number;
      matchIndex: number;
      expected?: { p1: string; p2: string };
    };

    record.matches = record.matches || [];
    const round = record.matches[roundIndex];
    if (!round || matchIndex >= round.matches.length) {
      if (expected) {
        return conflict(res, record);
      }
      return res.status(400).json({ success: 'false', message: round ? 'Invalid match index' : 'Invalid round index' });
    }
    if (!matchesExpected(round.matches[matchIndex], expected)) {
      return conflict(res, record);
    }

    round.matches.splice(matchIndex, 1);
    record.dateLastUpdated = Date.now();

    await recordDao.update(record);

    return res.status(200).json({ success: 'true', round });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error updating record' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/set/:id',
    handler: [csrfProtection, ensureAuthJson, bodyValidation(setMatchSchema), setMatchHandler],
  },
  {
    method: 'post',
    path: '/add/:id',
    handler: [csrfProtection, ensureAuthJson, bodyValidation(addMatchSchema), addMatchHandler],
  },
  {
    method: 'post',
    path: '/remove/:id',
    handler: [csrfProtection, ensureAuthJson, bodyValidation(removeMatchSchema), removeMatchHandler],
  },
];
