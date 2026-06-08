import { cardColorIdentity } from '@utils/cardutil';
import DraftRecord from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import { getColorCombination } from '@utils/sorting/Sort';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { abbreviate, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../../types/express';
import { associateNewDraft, associateWithExistingDraft } from './uploaddeck';

export const hedronImportPageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Cube ID is required');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to create a record for this cube');
      return redirect(req, res, '/404');
    }

    return render(
      req,
      res,
      'ImportHedronRecordPage',
      {
        cube,
      },
      {
        title: `${abbreviate(cube.name)} - Import from Hedron Network`,
        metadata: generateMeta(
          `Cube Cobra Import from Hedron Network: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${req.protocol}://${req.get('host')}/cube/records/hedron/${cube.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
};

const hedronRecordSchema = Joi.object({
  date: Joi.number().optional(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional().allow(''),
  players: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().optional(),
        name: Joi.string().min(1).max(255).required(),
      }),
    )
    .min(0)
    .max(50)
    .optional(),
  matches: Joi.array()
    .items(
      Joi.object({
        matches: Joi.array()
          .items(
            Joi.object({
              p1: Joi.string().required(),
              p2: Joi.string().required(),
              results: Joi.array().items(Joi.number().required()).length(3).required(),
            }),
          )
          .required(),
      }),
    )
    .optional(),
  trophy: Joi.array().items(Joi.string()).optional(),
}).unknown(true);

export const hedronImportHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Cube ID is required');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(req.params.id);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const user = req.user as User;
    if (!user) {
      req.flash('danger', 'You must be logged in to create a record');
      return redirect(req, res, '/login');
    }

    if (!isCubeEditable(cube, user)) {
      req.flash('danger', 'You do not have permission to create a record for this cube');
      return redirect(req, res, '/404');
    }

    const record = JSON.parse(req.body.record) as Partial<DraftRecord>;
    if (!record) {
      req.flash('danger', 'Record data is required');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    const newRecord: DraftRecord = {
      cube: cube.id,
      date: record.date || new Date().valueOf(),
      name: record.name || 'Hedron Network Import',
      description: record.description || '',
      players: record.players || [],
      matches: record.matches || [],
      trophy: record.trophy || [],
      id: uuidv4(),
    };

    const createdRecordId = await recordDao.createRecord(newRecord);

    if (!createdRecordId) {
      req.flash('danger', 'Error creating record');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    // Attach the auto-annotated decklists (oracle ids, keyed by 1-based player
    // index). The first deck creates the draft; the rest fill its other seats.
    const decks: { [playerIndex: string]: string[] } = req.body.decks ? JSON.parse(req.body.decks) : {};
    const withDecks = Object.entries(decks).filter(([, oracles]) => Array.isArray(oracles) && oracles.length > 0);
    if (withDecks.length > 0) {
      const created = await recordDao.getById(createdRecordId);
      if (created) {
        for (const [idx, oracles] of withDecks) {
          const userIndex = parseInt(idx, 10);
          const existingDraft = created.draft ? await draftDao.getById(created.draft) : undefined;
          if (existingDraft) {
            await associateWithExistingDraft(cube, existingDraft, userIndex, oracles, []);
          } else {
            // mutates `created` (sets created.draft) so subsequent players reuse it
            await associateNewDraft(cube, created, userIndex, oracles, []);
          }
        }

        // Name each deck by its colour archetype (Azorius, Boros, …) from the
        // cards we just placed — the player is still tracked in the record's
        // player list, so the deck heading reads as the archetype.
        if (created.draft) {
          const draft = await draftDao.getById(created.draft);
          if (draft) {
            let renamed = false;
            for (const seat of draft.seats) {
              const indices = (seat.mainboard ?? []).flat(2) as number[];
              if (indices.length === 0) continue;
              const colorSet = new Set<string>();
              for (const cardIndex of indices) {
                const card = draft.cards[cardIndex];
                if (card) {
                  for (const c of cardColorIdentity(card)) colorSet.add(c);
                }
              }
              seat.title = getColorCombination([...'WUBRG'].filter((c) => colorSet.has(c)));
              renamed = true;
            }
            if (renamed) {
              await draftDao.update(draft);
            }
          }
        }
      }
    }

    req.flash('success', 'Record imported from Hedron Network successfully');
    return redirect(req, res, `/cube/record/${createdRecordId}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, hedronImportPageHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(hedronRecordSchema, (req) => `/cube/records/hedron/${req.params.id}`, 'record'),
      hedronImportHandler,
    ],
  },
];
