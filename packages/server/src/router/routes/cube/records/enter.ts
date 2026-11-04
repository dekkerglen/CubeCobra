import DraftType from '@utils/datatypes/Draft';
import { PlayerList, Round, WinLossDraw } from '@utils/datatypes/Record';
import UserType from '@utils/datatypes/User';
import { cubeDao, draftDao, recordDao, userDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { abbreviate, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { isPlayedDraft, realignDraftSeats, seatAlignmentUnchanged } from 'serverutils/recordSeats';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';
import { associateDecksWithExistingDraft, associateDecksWithNewDraft } from './uploaddeck';

const MAX_PLAYERS = 16;
const MAX_DECK_CARDS = 200;

// Decks arrive keyed by 1-based seat index, which JSON turns into a string key.
const deckSchema = Joi.object({
  mainboard: Joi.array().items(Joi.string()).max(MAX_DECK_CARDS).required(),
  // Always submitted, even when empty: the deck writers read an absent sideboard as
  // "no sideboard" and clear the stored one.
  sideboard: Joi.array().items(Joi.string()).max(MAX_DECK_CARDS).required(),
});

// Deliberately laxer than edit/round.ts's roundSchema, which needs at least one match per
// round with both players named. A transcriber works from someone else's notes, and may know
// that a round happened, or that a player had a bye, without knowing every pairing. Empty
// rounds and half-filled pairings are entered as-is and persisted as-is.
const transcribeSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  date: Joi.number().required(),
  description: Joi.string().max(1000).allow('').required(),
  players: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().min(1).max(255).required(),
        userId: Joi.string().max(64).optional(),
        id: Joi.string().max(64).optional(),
      }),
    )
    .unique('name')
    .max(MAX_PLAYERS)
    .required(),
  // seatOrder[i] is the draft seat the player now at position i came from, or -1 for a player
  // added in this save. One entry per player, so a mismatched client is rejected rather than
  // silently reattributing decks. An index past the end of the draft yields a fresh seat,
  // the same as -1, so there is no upper bound to enforce here.
  seatOrder: Joi.array()
    .items(Joi.number().integer().min(-1))
    .length(Joi.ref('players.length'))
    .required()
    .messages({ 'array.length': 'Seat order must have exactly one entry per player' }),
  matches: Joi.array()
    .items(
      Joi.object({
        matches: Joi.array()
          .items(
            Joi.object({
              p1: Joi.string().max(255).allow('').required(),
              p2: Joi.string().max(255).allow('').required(),
              results: Joi.array().items(Joi.number().integer().min(0)).length(3).required(),
            }),
          )
          .required(),
      }),
    )
    .max(50)
    .required(),
  overrides: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        wins: Joi.number().integer().min(0).required(),
        losses: Joi.number().integer().min(0).required(),
        draws: Joi.number().integer().min(0).required(),
      }),
    )
    .required(),
  trophy: Joi.array().items(Joi.string()).max(MAX_PLAYERS).required(),
  decks: Joi.object().pattern(Joi.string().pattern(/^\d+$/), deckSchema).required(),
});

interface TranscribedRecord {
  name: string;
  date: number;
  description: string;
  players: PlayerList;
  seatOrder: number[];
  matches: Round[];
  overrides: { [playerName: string]: WinLossDraw };
  trophy: string[];
  decks: { [userIndex: number]: { mainboard: string[]; sideboard: string[] } };
}

// Commits a whole transcribed event in one request: overview, players, pairings, overrides,
// trophies and decks. Everything else edits a record a piece at a time through form POSTs
// that redirect; this one answers with JSON so the page keeps the rest of the user's typing.
//
// Order matters. Seats are realigned and the player list is replaced before any deck is
// written, because a deck is addressed by seat: writing decks first would attach them to
// whoever used to sit there.
//
// Player renames are deliberately NOT carried through. The client submits matches, overrides
// and trophies already keyed by the new names, so a rename pass would re-apply a mapping to
// data that already reflects it — and would swap a straight A/B name swap back again.
export const transcribeRecordHandler = async (req: Request, res: Response) => {
  try {
    const { error, value } = transcribeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: 'false', message: error.details[0]?.message || 'Invalid submission' });
    }
    const submission = value as TranscribedRecord;

    const record = req.params.id ? await recordDao.getById(req.params.id) : undefined;
    if (!record) {
      return res.status(404).json({ success: 'false', message: 'Record not found' });
    }

    const cube = await cubeDao.getById(record.cube);
    if (!cube || !isCubeViewable(cube, req.user) || record.cube !== cube.id) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    if (!isCubeEditable(cube, req.user)) {
      return res
        .status(403)
        .json({ success: 'false', message: 'You do not have permission to edit a record for this cube' });
    }

    const draft = record.draft ? await draftDao.getById(record.draft) : undefined;
    const hasDeckEdits = Object.keys(submission.decks).length > 0;
    // A record made by "Create from Draft" points at a real played draft, carrying pick and
    // trash orders and the pack history, and an InitialState positionally tied to its seats.
    // Such a draft is never written by this handler: not its pools, and not its seats.
    const playedDraft = isPlayedDraft(draft);

    if (playedDraft && draft) {
      if (hasDeckEdits) {
        // Replacing a played draft's seat pools would orphan all of the above.
        return res.status(400).json({
          success: 'false',
          message: 'This record is attached to a played draft, so its decks cannot be edited here.',
        });
      }

      // Leaving the draft untouched only stays safe while record.players[i] still describes
      // draft.seats[i]. Adding, removing or reordering players would break that pairing and
      // silently attribute played decks to the wrong people, so it is refused outright rather
      // than realigned — realigning would overwrite each seat's real drafter and title, and
      // desynchronize the pack history that is tied to the seats by position.
      if (!seatAlignmentUnchanged(submission.seatOrder, draft.seats.length)) {
        return res.status(400).json({
          success: 'false',
          message:
            'This record is attached to a played draft, so its players cannot be added, removed or reordered here. Renaming a player is still allowed.',
        });
      }
    }

    record.name = submission.name;
    record.date = submission.date;
    record.description = submission.description;

    // Read before the submitted list replaces it: whether the draft has to be rewritten at all
    // is decided by comparing the two.
    const previousPlayers = record.players;
    record.players = submission.players;

    // A key for a player dropped in this same save is discarded rather than persisted.
    const submittedNames = new Set(submission.players.map((player) => player.name));
    record.matches = submission.matches;
    record.overrides = Object.fromEntries(
      Object.entries(submission.overrides).filter(([name]) => submittedNames.has(name)),
    );
    record.trophy = submission.trophy.filter((name) => submittedNames.has(name));
    record.dateLastUpdated = Date.now();

    if (draft && !playedDraft) {
      // Realigning stamps every seat with its player's name, and DraftDynamoDao.update then
      // renames the whole draft after seat one. For a draft imported from a file or from
      // Hedron that is a real change: associateDecksWithNewDraft deliberately leaves the seat
      // titles unset so createDraft names each seat by its archetype. Doing it on a save that
      // only touched the overview would retitle every deck for nothing, so the realign — and
      // the draft write that persists it — are skipped unless the seats actually moved.
      const playersUnchanged =
        seatAlignmentUnchanged(submission.seatOrder, draft.seats.length) &&
        previousPlayers.length === submission.players.length &&
        submission.players.every(
          (player, index) =>
            player.name === previousPlayers[index]?.name && player.userId === previousPlayers[index]?.userId,
        );

      if (!playersUnchanged) {
        draft.seats = realignDraftSeats(draft.seats, submission.seatOrder, submission.players);
      }

      // One draft write either way: associateDecksWithExistingDraft issues its own, so calling
      // it with nothing to write would only burn a no-change update on top of this one.
      if (hasDeckEdits) {
        await associateDecksWithExistingDraft(cube, draft, submission.decks);
      } else if (!playersUnchanged) {
        await draftDao.update(draft);
      }

      await recordDao.update(record);
    } else if (!draft && hasDeckEdits) {
      // associateDecksWithNewDraft creates the draft, increments cube.numDecks, sets
      // record.draft and writes the record itself. The record is fully applied by this point,
      // so that write persists this whole save — and must not be followed by a second one, or
      // the record's optimistic lock rejects it.
      await associateDecksWithNewDraft(cube, record, submission.decks);
    } else {
      await recordDao.update(record);
    }

    return res.status(200).json({ success: 'true' });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error saving record' });
  }
};

// The workspace the above handler is the Save button for. Unlike the record page it is an
// editing surface, so it is gated on edit permission rather than visibility.
export const transcribeRecordPageHandler = async (req: Request, res: Response) => {
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

    if (!cube || !isCubeViewable(cube, req.user) || record.cube !== cube.id) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to edit a record for this cube');
      return redirect(req, res, `/cube/record/${record.id}`);
    }

    let draft: DraftType | undefined;
    if (record.draft) {
      draft = await draftDao.getById(record.draft);
    }

    // The accounts linked to the record's players, for their avatars in the player list.
    let players: UserType[] = [];
    const playerIds = record.players.map((player) => player.userId).filter((id) => id !== undefined);
    if (playerIds.length > 0) {
      players = (await userDao.batchGet(playerIds)).filter((user: UserType) => user !== undefined) as UserType[];
    }

    return render(
      req,
      res,
      'RecordTranscribePage',
      { cube, record, draft, players },
      { title: `${abbreviate(cube.name)} - Enter Event Data` },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/record/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, transcribeRecordPageHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, transcribeRecordHandler],
  },
];
