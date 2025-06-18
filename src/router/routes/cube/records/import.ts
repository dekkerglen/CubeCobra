import Joi from 'joi'; // Import Joi for validation
import { v4 as uuidv4 } from 'uuid';

import User from 'datatypes/User';

import DraftRecord from '../../../../datatypes/Record';
import Cube from '../../../../dynamo/models/cube';
import Draft from '../../../../dynamo/models/draft';
import Record from '../../../../dynamo/models/record';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';
import { getReasonableCardByOracle } from '../../../../util/carddb';
import { isCubeEditable, isCubeViewable } from '../../../../util/cubefn';
import { handleRouteError, redirect, render } from '../../../../util/render';
import { bodyValidation } from '../../../middleware/bodyValidation';
import { associateNewDraft, associateWithExistingDraft } from './uploaddeck';

export const importRecordPageHandler = async (req: Request, res: Response) => {
  try {
    // get `cards` query parameter if it exists
    const cards = req.query.o ? (Array.isArray(req.query.o) ? req.query.o : [req.query.o]) : [];

    const details = cards.map((card) => getReasonableCardByOracle(card as string)).filter((card) => card);

    return render(
      req,
      res,
      'ImportRecordPage',
      {
        cards: details,
      },
      {
        title: `Import Record`,
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
  description: Joi.string().min(0).max(1000).optional(), // Description is optional but can be long
  cube: Joi.string().optional(), // Cube ID is optional
  draft: Joi.string().optional(), // Draft ID is optional
  id: Joi.string().optional(), // Record ID is optional, will be generated if not provided
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
        p1: Joi.string().required(), // Player 1 ID
        p2: Joi.string().required(), // Player 2 ID
        results: Joi.array().items(Joi.number().required()).length(3).required(), // Results for each player
      }),
    )
    .optional(), // Matches array is optional
  trophy: Joi.array().items(Joi.string()).optional(), // Trophy is optional
}).unknown(false); // do not allow additional properties

const cardsSchema = Joi.array().items(Joi.string().required()).min(1).max(200).required();

export const importRecordHandler = async (req: Request, res: Response) => {
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

    const isNewRecord = req.body.newRecord === 'true' || req.body.newRecord === true;
    const parsedRecord = JSON.parse(req.body.record) as Partial<DraftRecord>;
    let recordId = parsedRecord?.id;

    if (isNewRecord) {
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

      recordId = await Record.put(newRecord);

      if (!recordId) {
        req.flash('danger', 'Error creating record');
        return redirect(req, res, `/cube/records/${req.params.id}`);
      }

      // wait 100ms to ensure the record is created
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // this is either the existing record or the newly created one
    const record = await Record.getById(recordId!);
    if (!record) {
      req.flash('danger', 'Record not found');
      return redirect(req, res, '/404');
    }

    const userIndex = parseInt(req.body.userIndex, 10);
    const cards = JSON.parse(req.body.cards);

    if (!record.draft) {
      // If the record does not have a draft, create one
      await associateNewDraft(cube, record, userIndex, cards);

      req.flash('success', 'Deck uploaded successfully. A new draft has been created and associated with this record');
      return redirect(req, res, `/cube/record/${recordId}?tab=1`);
    }

    const draft = await Draft.getById(record.draft);

    if (!draft) {
      // underlying draft object may have been deleted, we need to create a new one
      await associateNewDraft(cube, record, userIndex, cards);

      req.flash(
        'success',
        'Deck uploaded successfully. Draft not found, a new draft has been created and associated with this record.',
      );
      return redirect(req, res, `/cube/record/${recordId}?tab=1`);
    }

    // if this draft already has a deck for this user, we don't want to overwrite it
    if (draft.seats[userIndex - 1]?.mainboard?.flat(3).length > 0) {
      req.flash('danger', 'This user already has a deck associated with this draft.');
      return redirect(req, res, `/cube/records/uploaddeck/${record.id}`);
    }

    await associateWithExistingDraft(cube, draft, userIndex, cards);

    req.flash('success', 'Deck uploaded successfully. Draft associated with this record has been updated.');
    return redirect(req, res, `/cube/record/${recordId}?tab=1`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureAuth, importRecordPageHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(recordSchema, () => '/404', 'record'),
      bodyValidation(cardsSchema, () => '/404', 'cards'),
      importRecordHandler,
    ],
  },
];
