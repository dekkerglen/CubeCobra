import { cubeDao, recordDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../../types/express';

// Sets (or clears) a player's manual win/loss/draw override on a record. The
// override takes precedence over the match-derived total, letting an owner enter
// a record without polluting the match history with synthetic matches.
export const setOverrideHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid record ID');
      return redirect(req, res, '/404');
    }

    const record = await recordDao.getById(req.params.id);
    if (!record) {
      req.flash('danger', 'Record not found');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(record.cube);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }
    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to edit a record for this cube');
      return redirect(req, res, '/404');
    }

    const player = `${req.body.player ?? ''}`;
    if (!player) {
      req.flash('danger', 'No player specified');
      return redirect(req, res, `/cube/record/${req.params.id}`);
    }

    record.overrides = record.overrides || {};
    if (`${req.body.clear ?? ''}` === '1') {
      delete record.overrides[player];
    } else {
      const num = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
      record.overrides[player] = {
        wins: num(req.body.wins),
        losses: num(req.body.losses),
        draws: num(req.body.draws),
      };
    }
    record.dateLastUpdated = Date.now();

    await recordDao.update(record);

    req.flash('success', 'Updated record');
    return redirect(req, res, `/cube/record/${req.params.id}`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, setOverrideHandler],
  },
];
