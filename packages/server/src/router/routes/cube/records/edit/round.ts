import { Round } from '@utils/datatypes/Record';
import { roundProblems } from '@utils/records/roundChecks';
import { cubeDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { bodyValidation } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../../../types/express';

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

// The number of rounds the page showed when it sent the form, when it says. A different count
// means someone else added or removed a round since, so the form's idea of which round it is
// adding or removing is out of date.
const roundCountChanged = (req: Request, rounds: Round[]): boolean => {
  if (req.body.expectedRounds === undefined || req.body.expectedRounds === '') {
    return false;
  }
  return parseInt(`${req.body.expectedRounds}`, 10) !== rounds.length;
};

export const addRoundHandler = async (req: Request, res: Response) => {
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

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to edit a record for this cube');
      return redirect(req, res, '/404');
    }

    record.matches = record.matches || [];
    if (roundCountChanged(req, record.matches)) {
      req.flash(
        'danger',
        `This record has ${record.matches.length} round${record.matches.length === 1 ? '' : 's'} now, so the round you paired was out of date and wasn't added. Pair it again.`,
      );
      return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
    }

    const round: Round = JSON.parse(req.body.round);
    const problems = roundProblems(round, record.players);
    if (problems.length > 0) {
      req.flash('danger', `The round wasn't added: ${problems.join(' ')}`);
      return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
    }

    record.matches.push(round);
    record.dateLastUpdated = Date.now();

    await recordDao.update(record);

    req.flash('success', 'Added new round of matches to record successfully');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
  }
};

export const removeRoundHandler = async (req: Request, res: Response) => {
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
    if (roundCountChanged(req, record.matches)) {
      req.flash(
        'danger',
        'The rounds changed since this page loaded, so no round was removed. Check them and try again.',
      );
      return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
    }
    if (Number.isNaN(roundIndex) || roundIndex < 0 || roundIndex >= record.matches.length) {
      req.flash('danger', 'Invalid round index');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
    }

    record.matches.splice(roundIndex, 1);
    record.dateLastUpdated = Date.now();

    await recordDao.update(record);

    req.flash('success', 'Removed round from record successfully');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
  } catch {
    req.flash('danger', 'Error updating record');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=matches`);
  }
};

export const routes = [
  {
    method: 'post',
    path: '/add/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(roundSchema, (req) => `/cube/record/${req.params.id}?tab=matches`, 'round'),
      addRoundHandler,
    ],
  },
  {
    method: 'post',
    path: '/remove/:id',
    handler: [csrfProtection, ensureAuth, removeRoundHandler],
  },
];
