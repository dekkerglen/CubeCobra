import { cubeDao, recordDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../../types/express';

export const editTrophyHandler = async (req: Request, res: Response) => {
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
      req.flash('danger', 'You do not have permission to edit a trophy for this cube');
      return redirect(req, res, '/404');
    }

    const trophy: string[] = JSON.parse(req.body.trophy);
    if (!Array.isArray(trophy) || trophy.length === 0) {
      req.flash('danger', 'Trophy must be a non-empty array');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=2`);
    }

    // Ensure trophy is an array of valid user names from the list of players
    const validPlayers = ['Unknown Player', ...record.players.map((p) => p.name)];
    let updatedTrophies = trophy;
    for (const player of trophy) {
      if (typeof player !== 'string') {
        req.flash('danger', `Invalid player name in trophy: ${player}`);
        return redirect(req, res, `/cube/record/${req.params.id}?tab=2`);
      }
      //The trophy names may contain old player names which we will strip, rather than aborting the action
      if (!validPlayers.includes(player)) {
        updatedTrophies = updatedTrophies.filter((name) => name !== player);
      }
    }

    // Update the record with the new trophy
    record.trophy = updatedTrophies;

    await recordDao.put(record);

    req.flash('success', 'Trophy updated successfully');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=2`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=2`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, editTrophyHandler],
  },
];
