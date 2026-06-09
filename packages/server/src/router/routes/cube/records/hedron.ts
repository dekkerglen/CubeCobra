import DraftRecord from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import { cubeDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { abbreviate, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../../types/express';
import { associateDecksWithNewDraft } from './uploaddeck';

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
    // index). Each entry is a built mainboard + its leftover sideboard. We build
    // ONE draft with every seat filled in a single createDraft call — the same
    // pattern the regular draft workflow uses — so every seat is named from its
    // mainboard archetype (assessColors). (An incremental per-seat approach
    // doesn't work: draftDao.update skips seat-name recomputation once a title is
    // set, so only the first seat would get a name.)
    const decks: { [playerIndex: string]: { mainboard: string[]; sideboard?: string[] } } = req.body.decks
      ? JSON.parse(req.body.decks)
      : {};
    const decksByIndex: { [userIndex: number]: { mainboard: string[]; sideboard?: string[] } } = {};
    for (const [idx, deck] of Object.entries(decks)) {
      if (Array.isArray(deck?.mainboard) && deck.mainboard.length > 0) {
        decksByIndex[parseInt(idx, 10)] = { mainboard: deck.mainboard, sideboard: deck.sideboard ?? [] };
      }
    }
    if (Object.keys(decksByIndex).length > 0) {
      const created = await recordDao.getById(createdRecordId);
      if (created) {
        await associateDecksWithNewDraft(cube, created, decksByIndex);
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
