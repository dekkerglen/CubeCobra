import { setupPicks } from '@utils/draftutil';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { createPool } from 'serverutils/cube';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

// Empties a single seat's deck without removing the seat, so the player stays
// in the record (and keeps their standings/matches) rather than being orphaned.
export const removeDeckHandler = async (req: Request, res: Response) => {
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

    const seatIndex = parseInt(req.body.seatIndex, 10);

    if (!record.draft) {
      req.flash('danger', 'This record has no decks to remove');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
    }

    const draft = await draftDao.getById(record.draft);
    const seat = draft?.seats[seatIndex];
    if (!draft || Number.isNaN(seatIndex) || seatIndex < 0 || seatIndex >= draft.seats.length || !seat) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
    }

    // Clear the boards but keep the seat so record.players[seatIndex] still maps
    // to draft.seats[seatIndex]. Leftover entries in draft.cards are harmless.
    seat.mainboard = createPool() as number[][][];
    seat.sideboard = setupPicks(1, 8) as number[][][];

    await draftDao.update(draft);

    req.flash('success', 'Deck removed from this record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
  } catch {
    req.flash('danger', 'Error removing deck');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/remove/:id',
    handler: [csrfProtection, ensureAuth, removeDeckHandler],
  },
];
