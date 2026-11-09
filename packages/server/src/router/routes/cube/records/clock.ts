import { applyClockAction, ClockAction, MAX_ROUND_MINUTES, roundClocks } from '@utils/records/roundClock';
import { cubeDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureAuthJson } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const clockActionSchema = Joi.object({
  roundIndex: Joi.number().integer().min(0).required(),
  action: Joi.string().valid('start', 'pause', 'resume', 'add', 'clear').required(),
  minutes: Joi.number().integer().min(1).max(MAX_ROUND_MINUTES).optional(),
  // How many rounds the client sees, so a round removed elsewhere can't shift an action onto
  // the wrong round's clock.
  expectedRounds: Joi.number().integer().min(0).optional(),
}).unknown(false);

// Every round's clock and the server's time, for anyone who can see the record. `now` lets a
// device correct for its own clock being off, so every screen in the room shows the same time.
export const getClocksHandler = async (req: Request, res: Response) => {
  try {
    const record = req.params.id ? await recordDao.getById(req.params.id) : undefined;
    if (!record) {
      return res.status(404).json({ success: 'false', message: 'Record not found' });
    }
    const cube = await cubeDao.getById(record.cube);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Record not found' });
    }
    return res.status(200).json({ success: 'true', clocks: roundClocks(record.matches || []), now: Date.now() });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error fetching round clocks' });
  }
};

export const clockActionHandler = async (req: Request, res: Response) => {
  try {
    const record = req.params.id ? await recordDao.getById(req.params.id) : undefined;
    if (!record) {
      return res.status(404).json({ success: 'false', message: 'Record not found' });
    }
    const cube = await cubeDao.getById(record.cube);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }
    if (!isCubeEditable(cube, req.user)) {
      return res
        .status(403)
        .json({ success: 'false', message: 'You do not have permission to edit a record for this cube' });
    }

    const { roundIndex, action, minutes, expectedRounds } = req.body as {
      roundIndex: number;
      action: ClockAction;
      minutes?: number;
      expectedRounds?: number;
    };
    if (expectedRounds !== undefined && expectedRounds !== (record.matches || []).length) {
      return res.status(409).json({
        success: 'false',
        conflict: 'true',
        message: 'The rounds changed somewhere else. The latest are shown; try the clock again.',
        rounds: record.matches || [],
      });
    }
    const round = (record.matches || [])[roundIndex];
    if (!round) {
      return res.status(400).json({ success: 'false', message: 'Invalid round index' });
    }

    const now = Date.now();
    const clock = applyClockAction(round.clock, action, now, minutes);
    if (clock) {
      round.clock = clock;
    } else {
      delete round.clock;
    }
    record.dateLastUpdated = now;
    await recordDao.update(record);

    return res.status(200).json({ success: 'true', clock: clock ?? null, now });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error updating round clock' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [getClocksHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuthJson, bodyValidation(clockActionSchema), clockActionHandler],
  },
];
