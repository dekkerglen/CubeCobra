import Joi from 'joi';

import Cube from 'dynamo/models/cube';
import Record from 'dynamo/models/record';
import { csrfProtection, ensureAuth } from 'routes/middleware';
import { Request, Response } from '../../../../../types/express';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';
import { bodyValidation } from 'routes/middleware';

const recordSchema = Joi.array()
  .items(
    Joi.object({
      userId: Joi.string().optional(), // Optional userId
      name: Joi.string().min(1).max(255).required(), // Player name is required
    }),
  )
  .max(16)
  .required(); // Players array is required

export const editRecordPlayersHandler = async (req: Request, res: Response) => {
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

    const players = JSON.parse(req.body.players);
    record.players = players;
    await Record.put(record);

    req.flash('success', 'Record updated successfully');
    return redirect(req, res, `/cube/record/${req.params.id}`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, (req) => `/cube/record/${req.params.id}`, 'players'),
      editRecordPlayersHandler,
    ],
  },
];
