import { Match } from '@utils/datatypes/Record';
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

export const setMatchSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
  matchIndex: Joi.number().integer().min(0).required(),
  match: matchSchema.required(),
}).unknown(false);

export const addMatchSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
}).unknown(false);

export const removeMatchSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
  matchIndex: Joi.number().integer().min(0).required(),
}).unknown(false);

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

    const { roundIndex, matchIndex, match } = req.body as { roundIndex: number; matchIndex: number; match: Match };

    record.matches = record.matches || [];
    const round = record.matches[roundIndex];
    if (!round) {
      return res.status(400).json({ success: 'false', message: 'Invalid round index' });
    }
    if (matchIndex < 0 || matchIndex >= round.matches.length) {
      return res.status(400).json({ success: 'false', message: 'Invalid match index' });
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

    const { roundIndex } = req.body as { roundIndex: number };

    record.matches = record.matches || [];
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

    const { roundIndex, matchIndex } = req.body as { roundIndex: number; matchIndex: number };

    record.matches = record.matches || [];
    const round = record.matches[roundIndex];
    if (!round) {
      return res.status(400).json({ success: 'false', message: 'Invalid round index' });
    }
    if (matchIndex < 0 || matchIndex >= round.matches.length) {
      return res.status(400).json({ success: 'false', message: 'Invalid match index' });
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
