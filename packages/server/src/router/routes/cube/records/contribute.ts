import Joi from 'joi';

import { applyPlayerRenames } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import { setupPicks } from '@utils/draftutil';
import { cubeDao, draftDao, recordDao, userDao } from 'dynamo/daos';
import { bodyValidation, csrfProtection } from 'router/middleware';
import { createPool } from 'serverutils/cube';
import { abbreviate } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { reconcilePlayerIds, stampSeatPlayerIds } from 'serverutils/playerIdentity';
import { isPlayedDraft } from 'serverutils/recordSeats';
import { verifyRecordToken } from 'serverutils/recordShareToken';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';
import { associateNewDraft, associateWithExistingDraft } from './uploaddeck';

/**
 * Contribute is the only write in this tree reachable without an account — the share link is
 * the whole of the authorisation — and was the only one with no validation at all. The board
 * limits match uploaddeck's, which is the same operation performed by the cube's owner; the
 * name limit matches the record's own, so a contributor cannot submit a player the owner
 * could not have typed.
 */
export const contributeMainboardSchema = Joi.array().items(Joi.string()).min(1).max(200).required();
export const contributeSideboardSchema = Joi.array().items(Joi.string()).max(200).default([]);

// A count the page submits as text. `Joi.number().integer()` accepts the string form and
// rejects "1.5", "-1" and "abc", all of which Math.floor(Number(..)) would have quietly
// turned into a number.
const countField = Joi.number().integer().min(0).max(1000).required();

export const contributeBodySchema = Joi.object({
  token: Joi.string().min(1).required(),
  // -1 is the page's "add a new player" sentinel, so negatives are not bounded away here;
  // the handler resolves the index against the stored list either way.
  userIndex: Joi.number().integer().required(),
  newPlayer: Joi.string().max(255).allow('').default(''),
  renamePlayer: Joi.string().max(255).allow('').default(''),
  wins: countField,
  losses: countField,
  draws: countField,
  // Validated separately, each against its own schema, so a bad board names itself.
  mainboard: Joi.any(),
  sideboard: Joi.any(),
  // CSRFForm posts these alongside every form's own fields: the CSRF token and the honeypot
  // the bot-security middleware reads. Named rather than allowed through `unknown`, so the
  // schema still rejects anything this form does not send.
  _csrf: Joi.string().allow('').optional(),
  nickname: Joi.string().allow('').optional(),
}).unknown(false);

// Back to the form they came from, the same place the handler's own failures land. An
// invalid token simply 404s there, which is what it should do.
const contributeRedirect = (req: Request): string =>
  `/cube/records/contribute/${req.params.id}?token=${encodeURIComponent(`${req.body?.token ?? ''}`)}`;

const num = (v: unknown): number => Math.max(0, Math.floor(Number(v) || 0));

// A leading @ links the player to a CubeCobra account (matching the record
// player-list convention). Resolve it to a real user so the player shows up as
// a linked account; otherwise keep the typed name as-is.
const resolvePlayer = async (raw: string): Promise<{ name: string; userId?: string }> => {
  if (!raw.startsWith('@')) {
    return { name: raw };
  }
  const handle = raw.slice(1).trim();
  const linked = handle ? await userDao.getByUsername(handle) : null;
  const name = linked?.username || handle || raw;
  return linked?.id ? { name, userId: linked.id } : { name };
};

// Token-gated page where someone with the share link adds their deck to a record.
export const contributePageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid record ID');
      return redirect(req, res, '/404');
    }
    const record = await recordDao.getById(req.params.id);
    if (!record || !verifyRecordToken(record.id, `${req.query.token ?? ''}`)) {
      req.flash('danger', 'This contribution link is invalid or has expired.');
      return redirect(req, res, '/404');
    }
    const cube = await cubeDao.getById(record.cube);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const user = req.user as User | undefined;
    return render(
      req,
      res,
      'ContributeDeckPage',
      {
        cube,
        record: { id: record.id, name: record.name, players: record.players },
        token: `${req.query.token}`,
        // Lead with @ so it links to the logged-in CubeCobra account by default
        // (the record player-list convention for account handles).
        suggestedName: user?.username ? `@${user.username}` : '',
      },
      {
        title: `${abbreviate(cube.name)} - Add Your Deck`,
        metadata: generateMeta(
          cube.brief,
          cube.image.uri,
          `${req.protocol}://${req.get('host')}/cube/records/contribute/${record.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const contributeSubmitHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid record ID');
      return redirect(req, res, '/404');
    }
    const record = await recordDao.getById(req.params.id);
    if (!record || !verifyRecordToken(record.id, `${req.body.token ?? ''}`)) {
      req.flash('danger', 'This contribution link is invalid or has expired.');
      return redirect(req, res, '/404');
    }
    const cube = await cubeDao.getById(record.cube);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const mainboard: string[] = req.body.mainboard ? JSON.parse(req.body.mainboard) : [];
    // The contribute page has always submitted a sideboard; it used to be discarded
    // here, so anything a contributor sideboarded silently vanished.
    const sideboard: string[] = req.body.sideboard ? JSON.parse(req.body.sideboard) : [];
    if (mainboard.length === 0) {
      req.flash('danger', 'No cards to add');
      return redirect(req, res, `/cube/records/contribute/${record.id}?token=${encodeURIComponent(req.body.token)}`);
    }

    let userIndex = parseInt(req.body.userIndex, 10);
    // Captured before either branch below can mutate record.players, so both reconcile
    // against what was actually stored rather than against each other's intermediate state.
    const storedPlayers = record.players || [];
    const rawNewPlayer = `${req.body.newPlayer ?? ''}`.trim();
    if (rawNewPlayer) {
      const added = await resolvePlayer(rawNewPlayer);
      record.players = reconcilePlayerIds([...storedPlayers, added], storedPlayers);
      userIndex = record.players.length;
      if (record.draft) {
        const existingDraft = await draftDao.getById(record.draft);
        if (existingDraft) {
          existingDraft.seats.push({
            owner: added.userId,
            title: added.name,
            mainboard: createPool() as number[][][],
            sideboard: setupPicks(1, 8) as number[][][],
          });
          // A played draft's seats are historical and must never be stamped with a
          // record player's id — only an upload draft's seats exist to be reconciled.
          if (!isPlayedDraft(existingDraft)) {
            existingDraft.seats = stampSeatPlayerIds(existingDraft.seats, record.players);
          }
          await draftDao.update(existingDraft);
        }
      }
    }

    const target = record.players[userIndex - 1];
    if (!target) {
      req.flash('danger', 'Please pick or add a player');
      return redirect(req, res, `/cube/records/contribute/${record.id}?token=${encodeURIComponent(req.body.token)}`);
    }

    // An existing player can correct their name (or swap it for their account
    // handle) without losing their seat, deck or results.
    const rawRename = rawNewPlayer ? '' : `${req.body.renamePlayer ?? ''}`.trim();
    if (rawRename) {
      const renamed = await resolvePlayer(rawRename);
      if (renamed.name !== target.name || renamed.userId !== target.userId) {
        const taken = record.players.some(
          (player, index) => index !== userIndex - 1 && player.name.toLowerCase() === renamed.name.toLowerCase(),
        );
        if (taken) {
          req.flash('danger', `Another player in this record is already named ${renamed.name}`);
          return redirect(
            req,
            res,
            `/cube/records/contribute/${record.id}?token=${encodeURIComponent(req.body.token)}`,
          );
        }
        applyPlayerRenames(record, new Map([[target.name, renamed.name]]));
        // renamed carries no id of its own: resolve it against the pre-request stored list,
        // the same way a brand-new player's id would be resolved, rather than reassigning the
        // slot directly and losing the id reconcilePlayerIds would otherwise have inherited.
        const renamedPlayers = [...record.players];
        renamedPlayers[userIndex - 1] = renamed;
        record.players = reconcilePlayerIds(renamedPlayers, storedPlayers);
        if (record.draft) {
          const existingDraft = await draftDao.getById(record.draft);
          const seat = existingDraft?.seats[userIndex - 1];
          if (existingDraft && seat) {
            // Some import flows title seats by archetype; only replace a name title.
            if (seat.title === target.name) {
              seat.title = renamed.name;
            }
            seat.owner = renamed.userId;
            // Same guard as above: a played draft's seats are not ours to stamp.
            if (!isPlayedDraft(existingDraft)) {
              existingDraft.seats = stampSeatPlayerIds(existingDraft.seats, record.players);
            }
            await draftDao.update(existingDraft);
          }
        }
      }
    }
    const player = record.players[userIndex - 1] ?? target;

    // Their self-reported record (override), keyed by player name.
    record.overrides = record.overrides || {};
    record.overrides[player.name] = {
      wins: num(req.body.wins),
      losses: num(req.body.losses),
      draws: num(req.body.draws),
    };
    record.dateLastUpdated = Date.now();
    await recordDao.update(record);

    // Attach the deck (creates the draft if needed; fills this player's seat).
    if (!record.draft) {
      await associateNewDraft(cube, record, userIndex, mainboard, sideboard);
    } else {
      const existingDraft = await draftDao.getById(record.draft);
      if (existingDraft) {
        await associateWithExistingDraft(cube, existingDraft, userIndex, mainboard, sideboard);
      } else {
        await associateNewDraft(cube, record, userIndex, mainboard, sideboard);
      }
    }

    req.flash('success', 'Thanks! Your deck was added to the record.');
    return redirect(req, res, `/cube/record/${record.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, contributePageHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      bodyValidation(contributeBodySchema, (req) => contributeRedirect(req)),
      bodyValidation(contributeMainboardSchema, (req) => contributeRedirect(req), 'mainboard'),
      bodyValidation(contributeSideboardSchema, (req) => contributeRedirect(req), 'sideboard'),
      contributeSubmitHandler,
    ],
  },
];
