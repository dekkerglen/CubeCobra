import DraftRecord from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import Joi from 'joi'; // Import Joi for validation
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { abbreviate, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../../types/express';

export const createRecordPageHandler = async (req: Request, res: Response) => {
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
      'CreateNewRecordPage',
      {
        cube,
      },
      {
        title: `${abbreviate(cube.name)} - Create Record`,
        metadata: generateMeta(
          `Cube Cobra Create Record: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${req.protocol}://${req.get('host')}/cube/records/create/${cube.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

export const createRecordPageFromDraftHandler = async (req: Request, res: Response) => {
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

    const decks = await draftDao.queryByCube(cube.id);

    return render(
      req,
      res,
      'CreateRecordFromDraftPage',
      {
        cube,
        decks: decks.items,
        decksLastKey: decks.lastKey,
      },
      {
        title: `${abbreviate(cube.name)} - Create Record`,
        metadata: generateMeta(
          `Cube Cobra Create Record: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${req.protocol}://${req.get('host')}/cube/records/create/fromDraft/${cube.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

// Define the JOI schema for the record object
const recordSchema = Joi.object({
  date: Joi.number().optional(), // Ensure the date is valid and optional
  name: Joi.string().min(1).max(255).required(), // Name must be a string with a reasonable length
  description: Joi.string().max(1000).optional(), // Description is optional but can be long
  players: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().optional(), // Optional userId
        name: Joi.string().min(1).max(255).required(), // Player name is required
      }),
    )
    .min(0)
    .max(16)
    .optional(),
  matches: Joi.array()
    .items(
      Joi.object({
        p1: Joi.string().required(), // Player 1 ID
        p2: Joi.string().required(), // Player 2 ID
        results: Joi.array().items(Joi.number().required()).length(3).required(), // Results for each player
      }),
    )
    .optional(), // Matches array is optional
  trophy: Joi.array().items(Joi.string()).optional(), // Trophy is optional
}).unknown(true); // allow additional properties like dateCreated, dateLastUpdated

export const createRecordHandler = async (req: Request, res: Response) => {
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
      req.flash('danger', 'Record is required');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    const newRecord: DraftRecord = {
      cube: cube.id,
      date: record.date || new Date().valueOf(),
      name: record.name || 'New Record',
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

    req.flash('success', 'Record created successfully');
    return redirect(req, res, `/cube/record/${createdRecordId}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

export const createRecordFromDraftHandler = async (req: Request, res: Response) => {
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
      req.flash('danger', 'Record is required');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    const draftId = req.body.draft;

    if (!draftId) {
      req.flash('danger', 'Draft ID is required to create a record from a draft');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    const draft = await draftDao.getById(draftId);

    if (!draft || draft.cube !== cube.id) {
      req.flash('danger', 'Draft not found or does not belong to this cube');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    const newRecord: DraftRecord = {
      cube: cube.id,
      date: record.date || new Date().valueOf(),
      name: record.name || 'New Record',
      description: record.description || '',
      players: draft.seats.map((seat) => {
        if (seat.owner) {
          return {
            // if it's a string use it, otherwise use .id
            userId: typeof seat.owner === 'string' ? seat.owner : seat.owner.id,
            name: typeof seat.owner === 'string' ? seat.owner : seat.owner.username,
          };
        }
        return {
          name: 'Unknown Player',
        };
      }),
      matches: record.matches || [],
      trophy: record.trophy || [],
      draft: draftId,
      id: uuidv4(),
    };

    const createdRecordId = await recordDao.createRecord(newRecord);

    if (!createdRecordId) {
      req.flash('danger', 'Error creating record');
      return redirect(req, res, `/cube/records/${req.params.id}`);
    }

    req.flash('success', 'Record created successfully');
    return redirect(req, res, `/cube/record/${createdRecordId}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, createRecordPageHandler],
  },
  {
    method: 'get',
    path: '/fromDraft/:id',
    handler: [csrfProtection, ensureAuth, createRecordPageFromDraftHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, (req) => `/cube/records/create/${req.params.id}`, 'record'),
      createRecordHandler,
    ],
  },
  {
    method: 'post',
    path: '/fromDraft/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, (req) => `/cube/records/create/fromDraft/${req.params.id}`, 'record'),
      createRecordFromDraftHandler,
    ],
  },
];
