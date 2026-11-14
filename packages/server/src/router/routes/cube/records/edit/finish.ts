import { cubeDao, recordDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';
import { recordSiteActivity } from 'serverutils/siteActivity';

import { Request, Response } from '../../../../../types/express';

// The record, if it exists and the user may edit it; otherwise the response is already sent.
const loadForEdit = async (req: Request, res: Response) => {
  const record = req.params.id ? await recordDao.getById(req.params.id) : undefined;
  if (!record) {
    req.flash('danger', 'Record not found');
    redirect(req, res, '/404');
    return undefined;
  }
  const cube = await cubeDao.getById(record.cube);
  if (!isCubeViewable(cube, req.user)) {
    req.flash('danger', 'Cube not found');
    redirect(req, res, '/404');
    return undefined;
  }
  if (!isCubeEditable(cube, req.user)) {
    req.flash('danger', 'You do not have permission to edit a record for this cube');
    redirect(req, res, '/404');
    return undefined;
  }
  return record;
};

/**
 * Finishes an event: it stops being live, every round clock is put away, and the trophy goes
 * to whoever the organiser confirmed. `trophy` is a JSON list of player names; any name that
 * isn't a player is ignored, and leaving it out keeps the trophies as they were.
 */
export const finishHandler = async (req: Request, res: Response) => {
  try {
    const record = await loadForEdit(req, res);
    if (!record) {
      return undefined;
    }

    if (req.body.trophy !== undefined) {
      let names: unknown;
      try {
        names = JSON.parse(req.body.trophy);
      } catch {
        names = null;
      }
      if (!Array.isArray(names)) {
        req.flash('danger', 'The trophy list was not readable, so the event was not finished.');
        return redirect(req, res, `/cube/record/${req.params.id}?tab=standings`);
      }
      const listed = new Set(record.players.map((player) => player.name));
      record.trophy = [
        ...new Set(names.filter((name): name is string => typeof name === 'string' && listed.has(name))),
      ];
    }

    // Finishing an already finished event only updates its trophies.
    const wasFinished = !!record.finishedAt;
    record.matches = (record.matches || []).map(({ clock: _clock, ...round }) => round);
    record.finishedAt = Date.now();
    record.dateLastUpdated = record.finishedAt;
    await recordDao.update(record);
    if (!wasFinished) {
      recordSiteActivity('tournamentsFinished', req.logger);
    }

    req.flash('success', 'Tournament finished. These are the final standings.');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=standings`);
  } catch {
    req.flash('danger', 'Error finishing the tournament');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=standings`);
  }
};

// Reopens a finished event, for a round played after all or a result that came in late. The
// trophy stays where it was given; the live tools come back only while the event is recent.
export const reopenHandler = async (req: Request, res: Response) => {
  try {
    const record = await loadForEdit(req, res);
    if (!record) {
      return undefined;
    }

    delete record.finishedAt;
    record.dateLastUpdated = Date.now();
    await recordDao.update(record);

    req.flash('success', 'Tournament reopened.');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
  } catch {
    req.flash('danger', 'Error reopening the tournament');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, finishHandler],
  },
  {
    method: 'post',
    path: '/reopen/:id',
    handler: [csrfProtection, ensureAuth, reopenHandler],
  },
];
