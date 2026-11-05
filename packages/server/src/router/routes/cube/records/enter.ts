import DraftType from '@utils/datatypes/Draft';
import { PlayerList, WinLossDraw } from '@utils/datatypes/Record';
import UserType from '@utils/datatypes/User';
import { deckProjection, SectionBaselines, SectionKey, sectionsEqual } from '@utils/records/recordSections';
import { NameKeyedSections, rebaseNameKeyedSections } from '@utils/records/rebaseNames';
import { defaultRecordName } from '@utils/records/recordName';
import { cubeDao, draftDao, recordDao, userDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { abbreviate, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { reconcilePlayerIds, stampSeatPlayerIds } from 'serverutils/playerIdentity';
import { isPlayedDraft, realignDraftSeats, seatAlignmentUnchanged } from 'serverutils/recordSeats';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../../types/express';
import { associateDecksWithExistingDraft, associateDecksWithNewDraft } from './uploaddeck';

const MAX_PLAYERS = 16;
const MAX_DECK_CARDS = 200;
const MAX_ROUNDS = 50;

const winLossDrawSchema = Joi.object({
  wins: Joi.number().integer().min(0).required(),
  losses: Joi.number().integer().min(0).required(),
  draws: Joi.number().integer().min(0).required(),
});

// null means "no override" for that player, distinct from the key being entirely absent (="I
// did not touch this player's override this save"), which is how an untouched section stays
// unwritten below.
const overrideValueSchema = Joi.alternatives(winLossDrawSchema, Joi.valid(null));

const deckSchema = Joi.object({
  mainboard: Joi.array().items(Joi.string()).max(MAX_DECK_CARDS).required(),
  // Always submitted, even when empty: the deck writers read an absent sideboard as
  // "no sideboard" and clear the stored one.
  sideboard: Joi.array().items(Joi.string()).max(MAX_DECK_CARDS).required(),
});

const playerSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  userId: Joi.string().max(64).optional(),
  // Editing-time identity (serverutils/playerIdentity). Joi rejects unknown keys by default,
  // so this has to stay even though this schema is otherwise a rewrite — dropping it would
  // turn a save of a record whose players already have ids into a 400.
  id: Joi.string().max(64).optional(),
});

const overviewSectionSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  date: Joi.number().required(),
  description: Joi.string().max(1000).allow('').required(),
});

const playersSectionSchema = Joi.object({
  players: Joi.array().items(playerSchema).unique('name').max(MAX_PLAYERS).required(),
  // seatOrder[i] is the draft seat the player now at position i came from, or -1 for a player
  // added in this save. One entry per player, so a mismatched client is rejected rather than
  // silently reattributing decks. An index past the end of the draft yields a fresh seat,
  // the same as -1, so there is no upper bound to enforce here.
  seatOrder: Joi.array()
    .items(Joi.number().integer().min(-1))
    .length(Joi.ref('players.length'))
    .required()
    .messages({ 'array.length': 'Seat order must have exactly one entry per player' }),
});

// Deliberately laxer than edit/round.ts's roundSchema, which needs at least one match per
// round with both players named. A transcriber works from someone else's notes, and may know
// that a round happened, or that a player had a bye, without knowing every pairing. Empty
// rounds and half-filled pairings are entered as-is and persisted as-is.
const roundsSectionSchema = Joi.object({
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
    .max(MAX_ROUNDS)
    .required(),
});

const trophySectionSchema = Joi.object({
  trophy: Joi.array().items(Joi.string()).max(MAX_PLAYERS).required(),
});

// `sections` holds only the sections this save changed — a key that is not here is "I did not
// touch this", never "clear it". `overrides:<key>` and `decks:<key>` are per player rather
// than one block each: one contributor's self-reported result must not contest the other
// fifteen players' standings, and two contributors uploading different decks must not
// conflict with each other.
const sectionsSchema = Joi.object({
  overview: overviewSectionSchema,
  players: playersSectionSchema,
  rounds: roundsSectionSchema,
  trophy: trophySectionSchema,
})
  .pattern(/^overrides:.+$/, overrideValueSchema)
  .pattern(/^decks:.+$/, deckSchema)
  .required();

// Baselines mirror the same section shapes, except overrides and decks are maps (one entry
// per player key touched this save) rather than a single value, since `sections` can carry
// several of each at once.
const baselinesSchema = Joi.object({
  overview: overviewSectionSchema,
  players: playersSectionSchema,
  rounds: roundsSectionSchema,
  trophy: trophySectionSchema,
  overrides: Joi.object().pattern(Joi.string(), overrideValueSchema),
  decks: Joi.object().pattern(Joi.string(), deckSchema),
}).required();

// The player list as the client's workspace loaded it (`seeded.players`), sent on every save
// regardless of whether `players` itself is dirty — it is the identity reference
// `rebaseNameKeyedSections` needs to re-express a rounds/trophy/overrides submission in
// whatever name the stored list holds now. Optional rather than required: a client still
// running pre-fix JS at the moment of deploy sends no `identity`, and must keep working under
// the pre-fix behaviour (rebasing only when `players` itself is dirty) rather than 400.
// Deliberately without `.unique('name')` or `.max(MAX_PLAYERS)`, unlike playersSectionSchema's
// identical-looking list below. Those constraints exist to keep *stored* data well-formed, but
// identity only describes what the client's workspace already loaded — it is never written.
// contribute.ts and uploaddeck.ts both append a new player via
// `reconcilePlayerIds([...storedPlayers, added], storedPlayers)` with no uniqueness or count
// check, so a stored record can already hold a duplicate name or exceed MAX_PLAYERS. Imposing
// either constraint here would 400 every later save on such a record, including the
// players-section edit meant to repair it — identity is sent unconditionally and carries the
// stale as-loaded list regardless of what `sections.players` corrects to. Re-adding either
// constraint "to match" the section below would restore that lockout.
const identitySchema = Joi.object({
  players: Joi.array().items(playerSchema).required(),
}).optional();

const transcribeSectionsSchema = Joi.object({
  sections: sectionsSchema,
  baselines: baselinesSchema,
  identity: identitySchema,
}).required();

// What `sections` holds for the four whole-record keys; `overrides:<key>` and `decks:<key>`
// are read through the catch-all index signature and cast at the point of use, since their
// suffix is dynamic and Joi has already checked their shape.
interface TranscribeSections {
  overview?: NonNullable<SectionBaselines['overview']>;
  players?: NonNullable<SectionBaselines['players']>;
  rounds?: NonNullable<SectionBaselines['rounds']>;
  trophy?: NonNullable<SectionBaselines['trophy']>;
  [key: string]: unknown;
}

type DeckValue = { mainboard: string[]; sideboard: string[] };

const OVERRIDE_PREFIX = 'overrides:';
const DECK_PREFIX = 'decks:';
const EMPTY_DECK: DeckValue = { mainboard: [], sideboard: [] };

// A key suffix that parses as a plain integer is a seat position, not a player id — ids are
// never bare digits — which is what a page loaded from a record with no ids yet sends, for
// `decks:<N>` and `overrides:<N>` alike.
const resolvePlayerIndex = (rawKey: string, players: PlayerList): number | undefined => {
  if (/^\d+$/.test(rawKey)) {
    const index = Number(rawKey);
    return index < players.length ? index : undefined;
  }
  const index = players.findIndex((player) => player.id === rawKey);
  return index === -1 ? undefined : index;
};

// Commits only the sections of a transcribed event that changed since this workspace loaded:
// overview, players, pairings, per-player overrides and per-player decks. Everything else
// edits a record a piece at a time through form POSTs that redirect; this one answers with
// JSON so the page keeps the rest of the user's typing, and names which of their edits, if
// any, lost to a write that landed while this workspace was open.
//
// Order matters. Seats are realigned and the player list is applied before any deck is
// written, because a deck is addressed by seat: writing decks first would attach them to
// whoever used to sit there.
export const transcribeRecordHandler = async (req: Request, res: Response) => {
  try {
    const { error, value } = transcribeSectionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: 'false', message: error.details[0]?.message || 'Invalid submission' });
    }
    const sections = (value as { sections: TranscribeSections }).sections;
    const baselines = (value as { baselines: SectionBaselines }).baselines;
    const identity = (value as { identity?: { players: PlayerList } }).identity;

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
    const deckKeys = Object.keys(sections).filter((key) => key.startsWith(DECK_PREFIX));
    const overrideKeys = Object.keys(sections).filter((key) => key.startsWith(OVERRIDE_PREFIX));
    const playersSection = sections.players;

    // A record made by "Create from Draft" points at a real played draft, carrying pick and
    // trash orders and the pack history, and an InitialState positionally tied to its seats.
    // Such a draft is never written by this handler: not its pools, and not its seats.
    const playedDraft = isPlayedDraft(draft);

    if (playedDraft && draft) {
      if (deckKeys.length > 0) {
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
      // desynchronize the pack history that is tied to the seats by position. Nothing to
      // check when `players` was not even submitted: a rename-only save still reaches here.
      if (playersSection && !seatAlignmentUnchanged(playersSection.seatOrder, draft.seats.length)) {
        return res.status(400).json({
          success: 'false',
          message:
            'This record is attached to a played draft, so its players cannot be added, removed or reordered here. Renaming a player is still allowed.',
        });
      }
    }

    const previousPlayers = record.players;
    const applied: SectionKey[] = [];
    const conflicts: Array<{ section: SectionKey; stored: unknown }> = [];
    const echo: SectionBaselines = {};

    if (sections.overview) {
      const stored = { name: record.name, date: record.date, description: record.description };
      if (sectionsEqual(baselines.overview, stored)) {
        record.name = sections.overview.name;
        record.date = sections.overview.date;
        record.description = sections.overview.description;
        applied.push('overview');
        echo.overview = { name: record.name, date: record.date, description: record.description };
      } else {
        conflicts.push({ section: 'overview', stored });
      }
    }

    // Resolved regardless of whether the section below conflicts: decks and overrides key
    // themselves against this, so a players conflict must not also take down an unrelated
    // contributor's deck upload or override in the same save.
    let playersApplied = false;
    let finalPlayers = previousPlayers;
    let finalSeatOrder = previousPlayers.map((_, index) => index);

    if (playersSection) {
      const reconciled = reconcilePlayerIds(playersSection.players, previousPlayers);
      const stored = { players: previousPlayers, seatOrder: previousPlayers.map((_, index) => index) };
      if (sectionsEqual(baselines.players, stored)) {
        finalPlayers = reconciled;
        finalSeatOrder = playersSection.seatOrder;
        playersApplied = true;
        applied.push('players');
        // Echoes the post-reconciliation list, including any minted id: the client cannot
        // learn one from its own submission, since it was the server that assigned it.
        echo.players = { players: finalPlayers, seatOrder: finalPlayers.map((_, index) => index) };
      } else {
        conflicts.push({ section: 'players', stored });
      }
    } else {
      // Untouched this save, but still reconciled against itself so a legacy record with no
      // ids yet has scratch ids to resolve decks/overrides by, below. Nothing is written back
      // from this — `record.players` only changes when `playersApplied` is true.
      finalPlayers = reconcilePlayerIds(previousPlayers, previousPlayers);
    }

    // `matches` and `trophy` stay keyed by player name in storage, so a player renamed by a
    // different writer since this workspace loaded would make an unrelated rounds or trophy
    // edit look contested unless it is re-expressed in the stored name first — resolving each
    // submitted name to a player id via the player list this submission was built against,
    // then to the name that id currently holds in storage. `identity` carries that list on
    // every save, whether or not `players` itself is dirty — a contributor renaming
    // themselves via the share link dirties only `rounds`/`trophy`/`overrides` on the client,
    // never `players`, so keying this off `playersSection` would miss that direction
    // entirely (the spec's own motivating scenario). Falls back to the submission's own
    // `players` baseline for a client still running pre-`identity` JS at deploy time, which
    // only ever had the rebase when its own `players` section was present.
    const rebaseIdentity = identity?.players ?? (playersSection ? baselines.players?.players : undefined);
    const rebase = (content: NameKeyedSections): NameKeyedSections =>
      rebaseIdentity ? rebaseNameKeyedSections(content, rebaseIdentity, previousPlayers) : content;

    if (sections.rounds) {
      const stored = { matches: record.matches };
      const rebasedBaseline = rebase({ matches: baselines.rounds?.matches });
      if (sectionsEqual({ matches: rebasedBaseline.matches }, stored)) {
        // The value is rebased by the same mapping as the baseline, so what lands in storage
        // is expressed in whatever name the player holds now — never the submitter's stale one.
        record.matches = rebase({ matches: sections.rounds.matches }).matches ?? [];
        applied.push('rounds');
        echo.rounds = { matches: record.matches };
      } else {
        conflicts.push({ section: 'rounds', stored });
      }
    }

    if (sections.trophy) {
      const stored = { trophy: record.trophy };
      const rebasedBaseline = rebase({ trophy: baselines.trophy?.trophy });
      if (sectionsEqual({ trophy: rebasedBaseline.trophy }, stored)) {
        const rebasedValue = rebase({ trophy: sections.trophy.trophy }).trophy ?? [];
        // A name for a player dropped from the final list this same save is discarded rather
        // than persisted — the same rule `players` has always enforced.
        const validNames = new Set((playersApplied ? finalPlayers : previousPlayers).map((player) => player.name));
        record.trophy = rebasedValue.filter((name) => validNames.has(name));
        applied.push('trophy');
        echo.trophy = { trophy: record.trophy };
      } else {
        conflicts.push({ section: 'trophy', stored });
      }
    }

    for (const key of overrideKeys) {
      const rawKey = key.slice(OVERRIDE_PREFIX.length);
      const value = sections[key] as WinLossDraw | null;
      const index = resolvePlayerIndex(rawKey, finalPlayers);
      if (index === undefined) {
        // Another writer removed the player this entry is about: refuse rather than
        // resurrect them by writing an override under a name nothing points to any more.
        conflicts.push({ section: key as SectionKey, stored: null });
        continue;
      }
      const player = finalPlayers[index]!;
      // The name this identity currently holds in storage, not the name this submission
      // believes it has — a brand new player (no stored counterpart yet) falls back to its
      // own submitted name, since there is nothing stored to inherit from.
      const storedName =
        previousPlayers.find((candidate) => candidate.id && candidate.id === player.id)?.name ?? player.name;
      const stored = record.overrides?.[storedName] ?? null;
      const baseline = baselines.overrides?.[rawKey] ?? null;
      if (sectionsEqual(baseline, stored)) {
        if (value === null) {
          if (record.overrides) {
            delete record.overrides[storedName];
          }
        } else {
          record.overrides = { ...record.overrides, [storedName]: value };
        }
        applied.push(key as SectionKey);
        echo.overrides = { ...echo.overrides, [rawKey]: value };
      } else {
        conflicts.push({ section: key as SectionKey, stored });
      }
    }

    // 1-based, matching associateDecksWithExistingDraft/associateDecksWithNewDraft. Built
    // only from the deck sections that passed their baseline check, so a conflicting deck is
    // never handed to either writer.
    const deckEdits: { [seatIndex: number]: DeckValue } = {};
    for (const key of deckKeys) {
      const rawKey = key.slice(DECK_PREFIX.length);
      const value = sections[key] as DeckValue;
      const index = resolvePlayerIndex(rawKey, finalPlayers);
      if (index === undefined) {
        conflicts.push({ section: key as SectionKey, stored: EMPTY_DECK });
        continue;
      }
      const origin = finalSeatOrder[index] ?? -1;
      const seat = origin >= 0 ? draft?.seats[origin] : undefined;
      const stored = deckProjection(seat, draft?.cards ?? []);
      const baseline = baselines.decks?.[rawKey] ?? EMPTY_DECK;
      if (sectionsEqual(baseline, stored)) {
        deckEdits[index + 1] = value;
        applied.push(key as SectionKey);
        echo.decks = { ...echo.decks, [rawKey]: value };
      } else {
        conflicts.push({ section: key as SectionKey, stored });
      }
    }

    if (playersApplied) {
      record.players = finalPlayers;
    }

    const hasAppliedAnything = applied.length > 0;
    if (hasAppliedAnything) {
      record.dateLastUpdated = Date.now();
    }

    if (draft && !playedDraft) {
      // Realigning stamps every seat with its player's name, and DraftDynamoDao.update then
      // renames the whole draft after seat one. For a draft imported from a file or from
      // Hedron that is a real change: associateDecksWithNewDraft deliberately leaves the seat
      // titles unset so createDraft names each seat by its archetype. Doing it on a save that
      // only touched the overview would retitle every deck for nothing, so the realign — and
      // the draft write that persists it — are skipped unless the seats actually moved.
      const playersUnchanged =
        !playersApplied ||
        (seatAlignmentUnchanged(finalSeatOrder, draft.seats.length) &&
          previousPlayers.length === finalPlayers.length &&
          finalPlayers.every(
            (player, index) =>
              player.name === previousPlayers[index]?.name && player.userId === previousPlayers[index]?.userId,
          ));

      if (!playersUnchanged) {
        draft.seats = stampSeatPlayerIds(realignDraftSeats(draft.seats, finalSeatOrder, finalPlayers), finalPlayers);
      }

      // One draft write either way: associateDecksWithExistingDraft issues its own, so calling
      // it with nothing to write would only burn a no-change update on top of this one.
      if (Object.keys(deckEdits).length > 0) {
        await associateDecksWithExistingDraft(cube, draft, deckEdits);
      } else if (!playersUnchanged) {
        await draftDao.update(draft);
      }

      if (hasAppliedAnything) {
        await recordDao.update(record);
      }
    } else if (!draft && Object.keys(deckEdits).length > 0) {
      // associateDecksWithNewDraft creates the draft, increments cube.numDecks, sets
      // record.draft and writes the record itself. The record is fully applied by this point,
      // so that write persists this whole save — and must not be followed by a second one, or
      // the record's optimistic lock rejects it.
      await associateDecksWithNewDraft(cube, record, deckEdits);
    } else if (hasAppliedAnything) {
      await recordDao.update(record);
    }

    return res.status(200).json({ success: 'true', applied, conflicts, record: echo });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error saving record' });
  }
};

// The workspace the above handler is the Save button for. Unlike the record page it is an
// editing surface, so it is gated on edit permission rather than visibility.
// What a record the organiser has not named yet is called and dated: the page renders this,
// and the first save recreates it for any section the organiser left alone. Midnight UTC of
// their day, the way every record's date is stored, so the name and the list's Date column
// agree.
const newRecordOverview = () => {
  const now = new Date();
  return {
    name: defaultRecordName(now),
    date: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    description: '',
  };
};

/**
 * The workspace for a record that does not exist yet.
 *
 * "Input Finished Event" used to pass through a wizard purely to have an id before this page
 * could load — the wizard collected name, date and description, all three of which this page
 * already asks for in its own Event details card. The record is created by the first Save
 * instead, so opening this page and leaving creates nothing.
 */
export const transcribeNewRecordPageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Cube ID is required');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to create a record for this cube');
      return redirect(req, res, `/cube/records/${cube.id}`);
    }

    const record = {
      id: '',
      cube: cube.id,
      ...newRecordOverview(),
      players: [],
      matches: [],
      trophy: [],
    };

    return render(
      req,
      res,
      'RecordTranscribePage',
      { cube, record, players: [], isNew: true },
      { title: `${abbreviate(cube.name)} - Input Finished Event` },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/records/${req.params.id}`);
  }
};

/**
 * First Save of a record that does not exist yet: create it, then hand the request to the
 * ordinary save so there is exactly one implementation of what a save means.
 *
 * The body is validated *before* anything is created — a rejected payload must not leave an
 * empty record behind, which is the whole reason this path exists. A brand-new record has no
 * stored state, so no section can conflict and every one of them applies.
 */
export const transcribeNewRecordHandler = async (req: Request, res: Response) => {
  try {
    const { error, value } = transcribeSectionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: 'false', message: error.details[0]?.message || 'Invalid submission' });
    }

    if (!req.params.id) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    const cube = await cubeDao.getById(req.params.id);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    if (!isCubeEditable(cube, req.user)) {
      return res
        .status(403)
        .json({ success: 'false', message: 'You do not have permission to create a record for this cube' });
    }

    /**
     * Created in the state the client believes is already stored, not in the state it is
     * submitting. The delegated save compares what it finds against the baselines the client
     * sent, and reports a mismatch as someone else having edited the record underneath —
     * creating it from the submitted values would make the first save conflict with itself.
     *
     * `baselines.overview` is the page's prefilled name and date when the organiser changed
     * them; when they did not, the overview is not dirty and appears in neither, so the same
     * default the page was rendered with is used instead.
     */
    const baseline = (value as { baselines: SectionBaselines }).baselines.overview;
    const created = baseline ?? newRecordOverview();

    const createdRecordId = await recordDao.createRecord({
      cube: cube.id,
      name: created.name,
      date: created.date,
      description: created.description,
      players: [],
      matches: [],
      trophy: [],
      id: uuidv4(),
    });

    if (!createdRecordId) {
      return res.status(500).json({ success: 'false', message: 'Error creating record' });
    }

    // Delegating rather than reimplementing: everything a save does — players, rounds,
    // trophies, overrides, decks and the draft they hang off — is one long handler, and a
    // second copy of it for this path would be the version that falls behind. The id it reads
    // is the one just created, and the response gains it so the client can stop being new.
    req.params.id = createdRecordId;
    const sendJson = res.json.bind(res);
    res.json = (body: any) => sendJson({ ...body, recordId: createdRecordId });

    return transcribeRecordHandler(req, res);
  } catch (err) {
    return res.status(500).json({ success: 'false', message: (err as Error).message });
  }
};

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
    method: 'get',
    path: '/new/:id',
    handler: [csrfProtection, ensureAuth, transcribeNewRecordPageHandler],
  },
  {
    method: 'post',
    path: '/new/:id',
    handler: [csrfProtection, ensureAuth, transcribeNewRecordHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, transcribeRecordHandler],
  },
];
