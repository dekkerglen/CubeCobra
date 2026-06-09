import { setupPicks } from '@utils/draftutil';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { createPool } from 'serverutils/cube';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../../types/express';

const recordSchema = Joi.array()
  .items(
    Joi.object({
      userId: Joi.string().optional(), // Optional userId
      name: Joi.string().min(1).max(255).required(), // Player name is required
    }),
  )
  .max(16)
  .required(); // Players array is required

export const editRecordPlayersHandler = async (req: Request, res: Response) => {
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

    const players = JSON.parse(req.body.players);

    // seatOrder[i] is the original seat index that the new player at position i
    // came from, or -1 for a newly added player. Defaults to identity so an
    // older client (or a no-op edit) keeps the existing seat alignment.
    let seatOrder: number[];
    try {
      const parsed = req.body.seatOrder ? JSON.parse(req.body.seatOrder) : null;
      seatOrder =
        Array.isArray(parsed) && parsed.length === players.length
          ? parsed.map((value: unknown) => parseInt(`${value}`, 10))
          : players.map((_: unknown, index: number) => index);
    } catch {
      seatOrder = players.map((_: unknown, index: number) => index);
    }

    record.players = players;

    // Keep the associated draft's seats positionally aligned with the players.
    // Reusing the old seat at seatOrder[i] keeps each player's deck attached as
    // they move; -1 yields a fresh empty seat for a newly added player.
    if (record.draft) {
      const draft = await draftDao.getById(record.draft);
      if (draft) {
        const oldSeats = draft.seats;
        draft.seats = players.map((player: { name: string; userId?: string }, index: number) => {
          const origin = seatOrder[index] ?? -1;
          const base =
            origin >= 0 && origin < oldSeats.length
              ? oldSeats[origin]
              : { mainboard: createPool(), sideboard: setupPicks(1, 8) };
          return {
            ...base,
            owner: player.userId,
            title: player.name,
          };
        });
        await draftDao.update(draft);
      }
    }

    record.dateLastUpdated = Date.now();
    await recordDao.update(record);

    req.flash('success', 'Record updated successfully');
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
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, (req) => `/cube/record/${req.params.id}`, 'players'),
      editRecordPlayersHandler,
    ],
  },
];
