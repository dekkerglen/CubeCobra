import { applyPlayerRenames } from '@utils/datatypes/Record';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { isPlayedDraft, realignDraftSeats, seatAlignmentUnchanged } from 'serverutils/recordSeats';
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

    const names = players.map((player: { name: string }) => player.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      req.flash('danger', 'Each player in a record needs a unique name');
      return redirect(req, res, `/cube/record/${req.params.id}`);
    }

    // A player that kept their seat but changed name was renamed: carry the new
    // name through the matches, overrides and trophies that reference the old one.
    const previousPlayers = record.players;
    const renames = new Map<string, string>();
    players.forEach((player: { name: string }, index: number) => {
      const seat = seatOrder[index];
      const previous = seat === undefined ? undefined : record.players[seat];
      if (previous && previous.name !== player.name) {
        renames.set(previous.name, player.name);
      }
    });
    applyPlayerRenames(record, renames);

    record.players = players;

    // Keep the associated draft's seats positionally aligned with the players.
    if (record.draft) {
      const draft = await draftDao.getById(record.draft);
      if (draft) {
        // A played draft's seats are not ours to rewrite. `title` is a deck name its
        // owner typed (and names the whole draft, via seats[0]), `owner` is the person
        // who actually drafted, and InitialState[i] is tied to seats[i] by position — so
        // realigning would rename every deck and desynchronize the pack history.
        // An upload draft has none of that: its seats exist only to hold record decks and
        // their titles are the player names, so realignment there is both safe and needed.
        if (isPlayedDraft(draft)) {
          // seatOrder arrives from the client and falls back to identity when absent, so
          // the claim that nobody moved cannot be taken at its word. Corroborate it against
          // the players we already had: the same count, and no linked account that has
          // changed seats. Renaming a player, linking one to an account, and unlinking one
          // all leave the seats alone, so all three stay allowed; only moving an existing
          // account to a different index is a reorder wearing a rename's clothes.
          const previousSeatOf = new Map<string, number>();
          previousPlayers.forEach((player, index) => {
            if (player.userId) {
              previousSeatOf.set(player.userId, index);
            }
          });
          const sameSeats =
            seatAlignmentUnchanged(seatOrder, draft.seats.length) &&
            previousPlayers.length === players.length &&
            players.every((player: { userId?: string }, index: number) => {
              const previousSeat = player.userId === undefined ? undefined : previousSeatOf.get(player.userId);
              return previousSeat === undefined || previousSeat === index;
            });

          if (!sameSeats) {
            req.flash(
              'danger',
              'This record is attached to a played draft, so its players cannot be added, removed or reordered. Renaming a player is still allowed.',
            );
            return redirect(req, res, `/cube/record/${req.params.id}`);
          }
          // Every player kept their seat, so the renames above describe the same seats as
          // before and the draft needs no write at all.
        } else {
          draft.seats = realignDraftSeats(draft.seats, seatOrder, players);
          await draftDao.update(draft);
        }
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
