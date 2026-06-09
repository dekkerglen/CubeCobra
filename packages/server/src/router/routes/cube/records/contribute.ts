import { setupPicks } from '@utils/draftutil';
import User from '@utils/datatypes/User';
import { cubeDao, draftDao, recordDao, userDao } from 'dynamo/daos';
import { csrfProtection } from 'router/middleware';
import { createPool } from 'serverutils/cube';
import { abbreviate } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { verifyRecordToken } from 'serverutils/recordShareToken';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';
import { associateNewDraft, associateWithExistingDraft } from './uploaddeck';

const num = (v: unknown): number => Math.max(0, Math.floor(Number(v) || 0));

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
        title: `${abbreviate(cube.name)} - Add your deck`,
        metadata: generateMeta(
          `Cube Cobra: Add your deck to ${record.name}`,
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
    if (mainboard.length === 0) {
      req.flash('danger', 'No cards to add');
      return redirect(req, res, `/cube/records/contribute/${record.id}?token=${encodeURIComponent(req.body.token)}`);
    }

    let userIndex = parseInt(req.body.userIndex, 10);
    const rawNewPlayer = `${req.body.newPlayer ?? ''}`.trim();
    if (rawNewPlayer) {
      // A leading @ links the deck to a CubeCobra account (matching the record
      // player-list convention). Resolve it to a real user so the player shows up
      // as a linked account; otherwise store the typed name as-is.
      let name = rawNewPlayer;
      let linkedUserId: string | undefined;
      if (rawNewPlayer.startsWith('@')) {
        const handle = rawNewPlayer.slice(1).trim();
        const linked = handle ? await userDao.getByUsername(handle) : null;
        name = linked?.username || handle || rawNewPlayer;
        linkedUserId = linked?.id;
      }
      record.players = [...(record.players || []), linkedUserId ? { name, userId: linkedUserId } : { name }];
      userIndex = record.players.length;
      if (record.draft) {
        const existingDraft = await draftDao.getById(record.draft);
        if (existingDraft) {
          existingDraft.seats.push({
            owner: linkedUserId,
            title: name,
            mainboard: createPool() as number[][][],
            sideboard: setupPicks(1, 8) as number[][][],
          });
          await draftDao.update(existingDraft);
        }
      }
    }

    const target = record.players[userIndex - 1];
    if (!target) {
      req.flash('danger', 'Please pick or add a player');
      return redirect(req, res, `/cube/records/contribute/${record.id}?token=${encodeURIComponent(req.body.token)}`);
    }

    // Their self-reported record (override), keyed by player name.
    record.overrides = record.overrides || {};
    record.overrides[target.name] = { wins: num(req.body.wins), losses: num(req.body.losses), draws: num(req.body.draws) };
    record.dateLastUpdated = Date.now();
    await recordDao.update(record);

    // Attach the deck (creates the draft if needed; fills this player's seat).
    if (!record.draft) {
      await associateNewDraft(cube, record, userIndex, mainboard, []);
    } else {
      const existingDraft = await draftDao.getById(record.draft);
      if (existingDraft) {
        await associateWithExistingDraft(cube, existingDraft, userIndex, mainboard, []);
      } else {
        await associateNewDraft(cube, record, userIndex, mainboard, []);
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
    handler: [csrfProtection, contributeSubmitHandler],
  },
];
