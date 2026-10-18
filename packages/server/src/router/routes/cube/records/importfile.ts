import DraftRecord from '@utils/datatypes/Record';
import { RecordExportCard, RecordExportEntry } from '@utils/datatypes/RecordExport';
import { cubeDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureAuth } from 'router/middleware';
import { abbreviate, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { resolveExportCard } from 'serverutils/recordExport';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../../types/express';
import { associateDecksWithNewDraft } from './uploaddeck';

// The client sends a file's records in batches of at most this many.
export const MAX_RECORDS_PER_REQUEST = 25;

export const importFilePageHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }
    if (!isCubeEditable(cube, req.user)) {
      req.flash('danger', 'You do not have permission to import records into this cube');
      return redirect(req, res, `/cube/records/${cube.id}`);
    }

    return render(
      req,
      res,
      'ImportRecordsFilePage',
      { cube },
      {
        title: `${abbreviate(cube.name)} - Import Records`,
        metadata: generateMeta(
          `Cube Cobra Import Records: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${req.protocol}://${req.get('host')}/cube/records/importfile/${cube.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/records/${req.params.id}`);
  }
};

const cardSchema = Joi.alternatives().try(
  Joi.string().min(1).max(200),
  Joi.object({ name: Joi.string().min(1).max(200).required(), oracleId: Joi.string().max(64).optional() }).unknown(
    true,
  ),
);
const cardListSchema = Joi.array().items(cardSchema).max(500);

const recordSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  date: Joi.number().required(),
  description: Joi.string().max(5000).optional().allow(''),
  players: Joi.array()
    .items(Joi.object({ name: Joi.string().min(1).max(255).required(), userId: Joi.string().max(64).optional() }))
    .unique('name')
    .max(50)
    .required(),
  rounds: Joi.array()
    .items(
      Joi.object({
        matches: Joi.array()
          .items(
            Joi.object({
              p1: Joi.string().required().allow(''),
              p2: Joi.string().required().allow(''),
              results: Joi.array().items(Joi.number().integer().min(0)).length(3).required(),
            }),
          )
          .required(),
      }),
    )
    .max(50)
    .optional(),
  trophy: Joi.array().items(Joi.string()).max(50).optional(),
  overrides: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        wins: Joi.number().integer().min(0).required(),
        losses: Joi.number().integer().min(0).required(),
        draws: Joi.number().integer().min(0).required(),
      }),
    )
    .optional(),
  decks: Joi.object()
    .pattern(Joi.string(), Joi.object({ mainboard: cardListSchema.required(), sideboard: cardListSchema.optional() }))
    .optional(),
}).unknown(true);

const importSchema = Joi.object({
  records: Joi.array().items(recordSchema).min(1).max(MAX_RECORDS_PER_REQUEST).required(),
});

// Creates one new record per entry — never updates existing ones, so importing the
// same file twice makes duplicates. Problems that don't block a record (unknown
// cards, decks for players not in the record) come back as warnings.
export const importFileHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }
    if (!isCubeEditable(cube, req.user)) {
      return res.status(403).json({ success: 'false', message: 'You do not have permission to import records' });
    }

    const entries = req.body.records as RecordExportEntry[];
    const cubeCards = await cubeDao.getCards(cube.id);
    const created: { id: string; name: string }[] = [];
    const warnings: string[] = [];

    for (const entry of entries) {
      const newRecord: DraftRecord = {
        id: uuidv4(),
        cube: cube.id,
        date: entry.date,
        name: entry.name,
        description: entry.description ?? '',
        players: entry.players.map((p) => (p.userId ? { name: p.name, userId: p.userId } : { name: p.name })),
        matches: (entry.rounds ?? []).map((round) => ({
          matches: round.matches.map((m) => ({
            p1: m.p1,
            p2: m.p2,
            results: [m.results[0] ?? 0, m.results[1] ?? 0, m.results[2] ?? 0],
          })),
        })),
        trophy: entry.trophy ?? [],
        ...(entry.overrides ? { overrides: entry.overrides } : {}),
      };

      const recordId = await recordDao.createRecord(newRecord);
      created.push({ id: recordId, name: entry.name });

      // Decks are keyed by player name; the draft wants them by 1-based player index.
      const indexByName = new Map(newRecord.players.map((p, i) => [p.name, i + 1]));
      const decksByIndex: { [userIndex: number]: { mainboard: string[]; sideboard?: string[] } } = {};
      const unresolved = new Set<string>();
      const resolve = (cards: RecordExportCard[]) =>
        cards
          .map((card) => {
            const oracle = resolveExportCard(card);
            if (!oracle) unresolved.add(typeof card === 'string' ? card : card.name);
            return oracle;
          })
          .filter((oracle): oracle is string => !!oracle);

      for (const [playerName, deck] of Object.entries(entry.decks ?? {})) {
        const index = indexByName.get(playerName);
        if (!index) {
          warnings.push(`${entry.name}: skipped the deck for "${playerName}", who isn't one of its players.`);
          continue;
        }
        const mainboard = resolve(deck.mainboard);
        if (mainboard.length > 0) decksByIndex[index] = { mainboard, sideboard: resolve(deck.sideboard ?? []) };
      }
      if (unresolved.size > 0) {
        warnings.push(`${entry.name}: couldn't find ${[...unresolved].map((n) => `"${n}"`).join(', ')}.`);
      }

      if (Object.keys(decksByIndex).length > 0) {
        const record = await recordDao.getById(recordId);
        if (record) await associateDecksWithNewDraft(cube, record, decksByIndex, cubeCards);
      }
    }

    return res.status(200).json({ success: 'true', created, warnings });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error importing records' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, importFilePageHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, bodyValidation(importSchema), importFileHandler],
  },
];
