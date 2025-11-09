import Joi from 'joi';

import Cube from 'dynamo/models/cube';
import Record from 'dynamo/models/record';
import { csrfProtection, ensureAuth } from 'routes/middleware';
import { Request, Response } from '../../../../../types/express';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';
import { bodyValidation } from 'routes/middleware';

// Define the JOI schema for the record object
const roundSchema = Joi.object({
  matches: Joi.array()
    .items(
      Joi.object({
        p1: Joi.string().required(), // Player 1 ID
        p2: Joi.string().required(), // Player 2 ID
        results: Joi.array().items(Joi.number().required()).length(3).required(), // Results for each player
      }),
    )
    .min(1)
    .required(), // At least one match is required
}).unknown(false); // don't additional properties

export const addRoundHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid record ID');
      return redirect(req, res, '/404');
    }

    const record = await Record.getById(req.params.id);

    if (!record) {
      req.flash('danger', 'Record not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(record.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to edit a record for this cube');
      return redirect(req, res, '/404');
    }

    record.matches = record.matches || [];
    record.matches.push(JSON.parse(req.body.round));

    await Record.put(record);

    req.flash('success', 'Added new round of matches to record successfully');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=3`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=3`);
  }
};

export const editRoundHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid record ID');
      return redirect(req, res, '/404');
    }

    const record = await Record.getById(req.params.id);

    if (!record) {
      req.flash('danger', 'Record not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(record.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to edit a record for this cube');
      return redirect(req, res, '/404');
    }

    const roundIndex = parseInt(req.body.roundIndex, 10);

    record.matches = record.matches || [];
    if (roundIndex < 0 || roundIndex >= record.matches.length) {
      req.flash('danger', 'Invalid round index');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=3`);
    }

    record.matches[roundIndex] = JSON.parse(req.body.round);

    await Record.put(record);

    req.flash('success', 'Added new round of matches to record successfully');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=3`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=3`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/add/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(roundSchema, (req) => `/cube/record/${req.params.id}?tab=3`, 'round'),
      addRoundHandler,
    ],
  },
  {
    method: 'post',
    path: '/edit/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(roundSchema, (req) => `/cube/record/${req.params.id}?tab=3`, 'round'),
      editRoundHandler,
    ],
  },
];
