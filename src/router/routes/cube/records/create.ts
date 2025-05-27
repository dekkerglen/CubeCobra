import Joi from 'joi'; // Import Joi for validation
import { v4 as uuidv4 } from 'uuid';

import User from 'datatypes/User';

import DraftRecord from '../../../../datatypes/Record';
import Cube from '../../../../dynamo/models/cube';
import Record from '../../../../dynamo/models/record';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';
import { abbreviate, isCubeEditable, isCubeViewable } from '../../../../util/cubefn';
import generateMeta from '../../../../util/meta';
import { handleRouteError, redirect, render } from '../../../../util/render';
import { bodyValidation } from '../../../middleware/bodyValidation';

export const createRecordPageHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id);

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
        metadata: generateMeta(`Cube Cobra Create Record: ${cube.name}`, cube.description, cube.image.uri),
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
    .max(16)
    .optional(), // At least one player is optional
  matches: Joi.array()
    .items(
      Joi.object({
        player1: Joi.string().required(), // Player 1's name or ID
        player2: Joi.string().required(), // Player 2's name or ID
        result: Joi.string().valid('win', 'loss', 'draw').required(), // Match result
      }),
    )
    .optional(), // Matches array is optional
  trophy: Joi.array().items(Joi.string()).optional(), // Trophy is optional
}).unknown(false); // do not allow additional properties

export const createRecordHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id);
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

    const createdRecordId = await Record.put(newRecord);

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
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, (req) => `/cube/records/create/${req.params.id}`, 'record'),
      createRecordHandler,
    ],
  },
];
