import { applyPlayerRenames, Round } from '@utils/datatypes/Record';
import { BYE } from '@utils/records/pairings';
import { isReservedName, playersWithMatches } from '@utils/records/roundChecks';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { reconcilePlayerIds, stampSeatPlayerIds } from 'serverutils/playerIdentity';
import { isPlayedDraft, realignDraftSeats, seatAlignmentUnchanged } from 'serverutils/recordSeats';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../../types/express';

const recordSchema = Joi.array()
  .items(
    Joi.object({
      userId: Joi.string().optional(), // Optional userId
      name: Joi.string().min(1).max(255).required(), // Player name is required
      id: Joi.string().max(64).optional(), // Editing-time identity, carried back by a client that already has one
    }),
  )
  .max(16)
  .required(); // Players array is required

// Round one, sent with the seating by a table that paired it, checked against the players being
// saved: every name seated, nobody paired twice, and only a bye in place of an opponent. Null
// when it doesn't hold together, so a stale or hand-edited form can't store a round naming
// someone who isn't at the table.
const parseFirstRound = (raw: unknown, names: string[]): Round | null => {
  try {
    const round = JSON.parse(`${raw}`);
    if (!round || !Array.isArray(round.matches) || round.matches.length === 0) {
      return null;
    }
    const seated = new Set(names);
    const paired = new Set<string>();
    const matches = [];
    for (const { p1, p2, results } of round.matches) {
      const sides = p2 === BYE ? [p1] : [p1, p2];
      if (sides.some((name) => typeof name !== 'string' || !seated.has(name) || paired.has(name)) || p1 === p2) {
        return null;
      }
      if (!Array.isArray(results) || results.length !== 3 || results.some((n) => !Number.isInteger(n) || n < 0)) {
        return null;
      }
      sides.forEach((name) => paired.add(name));
      matches.push({ p1, p2, results: [...results] as [number, number, number] });
    }
    return { matches };
  } catch {
    return null;
  }
};

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

    // Reconcile against the stored list immediately: an older client that doesn't echo ids
    // back must not cause this record's players to mint fresh ones and orphan their seats.
    const players = reconcilePlayerIds(JSON.parse(req.body.players), record.players);

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

    // The roster the form was built from, when it says. Every seat in seatOrder is a position in
    // that list, so if anyone has been added, removed, renamed or moved since, those positions
    // point at different people now: a deck would follow the wrong player, and a rename would be
    // read off the wrong seat. Refused rather than guessed at.
    if (req.body.expectedPlayers) {
      let expected: unknown;
      try {
        expected = JSON.parse(req.body.expectedPlayers);
      } catch {
        expected = null;
      }
      const stored = record.players.map((player) => player.name);
      if (
        !Array.isArray(expected) ||
        expected.length !== stored.length ||
        expected.some((name, index) => name !== stored[index])
      ) {
        req.flash(
          'danger',
          'The players changed somewhere else since this page loaded, so nothing was saved. Here is the latest list; make your change again.',
        );
        return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
      }
    }

    const reserved = players.find((player: { name: string }) => isReservedName(player.name));
    if (reserved) {
      req.flash('danger', `"${reserved.name}" can't be a player's name: pairings use it for something else.`);
      return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
    }

    // A player who has been in a match can't just disappear: their opponents' results would point
    // at nobody. Dropping them keeps the results and stops them being paired.
    const kept = new Set(seatOrder);
    const played = playersWithMatches(record);
    const removedWithMatches = record.players.filter((player, index) => !kept.has(index) && played.has(player.name));
    if (removedWithMatches.length > 0) {
      const names = removedWithMatches.map((player) => player.name).join(', ');
      req.flash(
        'danger',
        `${names} already ${removedWithMatches.length === 1 ? 'has' : 'have'} matches in this event, so can't be removed. Drop them from the Standings tab instead, or remove their matches first.`,
      );
      return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
    }

    const names = players.map((player: { name: string }) => player.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      req.flash('danger', 'Each player in a record needs a unique name');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
    }

    // A table that paired round one sends it along, so seating and pairing are one save. Only a
    // record with no rounds yet takes one: otherwise the table was opened before someone else
    // added a round, and saving it would put two first rounds on the record.
    let firstRound: Round | null = null;
    if (req.body.firstRound) {
      if ((record.matches ?? []).some((round) => round.matches.length > 0)) {
        req.flash('danger', 'This record already has a round, so round one was not paired again. Nothing was saved.');
        return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
      }
      firstRound = parseFirstRound(
        req.body.firstRound,
        players.map((player: { name: string }) => player.name),
      );
      if (!firstRound) {
        req.flash('danger', 'Round one did not match the players at the table. Nothing was saved.');
        return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
      }
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
            return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
          }
          // Every player kept their seat, so the renames above describe the same seats as
          // before and the draft needs no write at all.
        } else {
          draft.seats = stampSeatPlayerIds(realignDraftSeats(draft.seats, seatOrder, players), players);
          await draftDao.update(draft);
        }
      }
    }

    if (firstRound) {
      record.matches = [firstRound];
    }

    record.dateLastUpdated = Date.now();
    await recordDao.update(record);

    if (firstRound) {
      req.flash('success', 'Seated the table and paired round one');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
    }
    req.flash('success', 'Record updated successfully');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=players`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, (req) => `/cube/record/${req.params.id}?tab=players`, 'players'),
      editRecordPlayersHandler,
    ],
  },
];
