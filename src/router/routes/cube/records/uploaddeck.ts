import Joi from 'joi';

import CardType from 'datatypes/Card';
import CubeType from 'datatypes/Cube';
import DraftType from 'datatypes/Draft';
import RecordType from 'datatypes/Record';
import { cardOracleId } from 'utils/cardutil';

import Cube from '../../../../dynamo/models/cube';
import Draft from '../../../../dynamo/models/draft';
import Record from '../../../../dynamo/models/record';
import { bodyValidation } from '../../../../router/middleware/bodyValidation';
import { addBasics, createPool } from '../../../../routes/cube/helper';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';
import { cardFromId, getReasonableCardByOracle, getVersionsByOracleId } from '../../../../util/carddb';
import { isCubeEditable, isCubeViewable } from '../../../../util/cubefn';
import { setupPicks } from '../../../../util/draftutil';
import { handleRouteError, redirect, render } from '../../../../util/render';

export const uploadDeckPageHandler = async (req: Request, res: Response) => {
  try {
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

    let draft: DraftType | undefined;
    if (record.draft) {
      draft = await Draft.getById(record.draft);
    }

    return render(req, res, 'RecordUploadDeckPage', {
      cube,
      record,
      draft,
    });
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
};

const mainboardSchema = Joi.array().items(Joi.string()).min(1).max(200).required();
const sideboardSchema = Joi.array().items(Joi.string()).max(200).default([]);

export const associateNewDraft = async (cube: CubeType, record: RecordType, userIndex: number, mainboardOracles: string[], sideboardOracles: string[] = []) => {
  const cubeCards = await Cube.getCards(cube.id);
  const { mainboard } = cubeCards;

  const deck: number[][][] = createPool();
  const sideboard: number[][][] = setupPicks(1, 8);
  const cards: CardType[] = [];

  const processCard = (oracle: string, targetPool: number[][][], isSideboard: boolean) => {
    let selected = null;
    const potentialIds = getVersionsByOracleId(oracle);
    const inCube = mainboard.find((c: CardType) => cardOracleId(c) === oracle);
    if (inCube) {
      selected = {
        finish: inCube.finish,
        imgBackUrl: inCube.imgBackUrl,
        imgUrl: inCube.imgUrl,
        cardID: inCube.cardID,
        details: cardFromId(inCube.cardID),
      };
    } else {
      const reasonableCard = getReasonableCardByOracle(oracle);
      const reasonableId = reasonableCard ? reasonableCard.scryfall_id : null;
      const selectedId = reasonableId || potentialIds[0];
      selected = {
        cardID: selectedId,
        details: cardFromId(selectedId),
      };
    }

    if (selected) {
      const isCreature = selected.details.type.toLowerCase().includes('creature');
      const cmc = selected.details.cmc;

      const row = isSideboard ? 0 : (isCreature ? 0 : 1);
      const col = Math.max(0, Math.min(7, Math.floor(cmc)));

      targetPool[row][col].push(cards.length);
      cards.push(selected);
    }
  };

  for (const oracle of mainboardOracles) {
    processCard(oracle, deck, false);
  }

  for (const oracle of sideboardOracles) {
    processCard(oracle, sideboard, true);
  }

  const newDraft = {
    cube: cube.id,
    owner: cube.owner.id,
    cubeOwner: cube.owner.id,
    date: record.date,
    type: Draft.TYPES.UPLOAD,
    cards: cards,
    seats: record.players.map((player) => ({
      owner: player.userId,
      title: `${player.name}`,
      mainboard: createPool() as number[][][],
      sideboard: setupPicks(1, 8) as number[][][],
    })),
    complete: true,
    basics: cube.basics,
  };

  newDraft.seats[userIndex - 1].mainboard = deck;
  newDraft.seats[userIndex - 1].sideboard = sideboard;

  addBasics(newDraft, cube.basics);

  const id = await Draft.put(newDraft);

  cube.numDecks += 1;
  await Cube.update(cube);

  record.draft = id;
  await Record.put(record);
};

export const associateWithExistingDraft = async (
  cube: CubeType,
  draft: DraftType,
  userIndex: number,
  mainboardOracles: string[],
  sideboardOracles: string[] = [],
) => {
  const cubeCards = await Cube.getCards(cube.id);
  const { mainboard } = cubeCards;

  const deck: number[][][] = createPool();
  const sideboard: number[][][] = setupPicks(1, 8);
  const cards: CardType[] = draft.cards;

  const processCard = (oracle: string, targetPool: number[][][], isSideboard: boolean) => {
    let selected = null;
    const potentialIds = getVersionsByOracleId(oracle);
    const inCube = mainboard.find((c: CardType) => cardOracleId(c) === oracle);
    if (inCube) {
      selected = {
        finish: inCube.finish,
        imgBackUrl: inCube.imgBackUrl,
        imgUrl: inCube.imgUrl,
        cardID: inCube.cardID,
        details: cardFromId(inCube.cardID),
      };
    } else {
      const reasonableCard = getReasonableCardByOracle(oracle);
      const reasonableId = reasonableCard ? reasonableCard.scryfall_id : null;
      const selectedId = reasonableId || potentialIds[0];
      selected = {
        cardID: selectedId,
        details: cardFromId(selectedId),
      };
    }

    if (selected) {
      const isCreature = selected.details.type.toLowerCase().includes('creature');
      const cmc = selected.details.cmc;

      const row = isSideboard ? 0 : (isCreature ? 0 : 1);
      const col = Math.max(0, Math.min(7, Math.floor(cmc)));

      targetPool[row][col].push(cards.length);
      cards.push(selected);
    }
  };

  for (const oracle of mainboardOracles) {
    processCard(oracle, deck, false);
  }

  for (const oracle of sideboardOracles) {
    processCard(oracle, sideboard, true);
  }

  draft.seats[userIndex - 1].mainboard = deck;
  draft.seats[userIndex - 1].sideboard = sideboard;

  await Draft.put(draft);
};

export const uploadDeckHandler = async (req: Request, res: Response) => {
  try {
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
      req.flash('danger', 'You do not have permission to upload a deck for this cube');
      return redirect(req, res, `/cube/records/${cube.id}`);
    }

    const userIndex = parseInt(req.body.userIndex, 10);
    const mainboard = JSON.parse(req.body.mainboard);
    const sideboard = req.body.sideboard ? JSON.parse(req.body.sideboard) : [];

    if (!record.draft) {
      // If the record does not have a draft, create one
      await associateNewDraft(cube, record, userIndex, mainboard, sideboard);

      req.flash('success', 'Deck uploaded successfully. A new draft has been created and associated with this record');
      return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
    }

    const draft = await Draft.getById(record.draft);

    if (!draft) {
      // underlying draft object may have been deleted, we need to create a new one
      await associateNewDraft(cube, record, userIndex, mainboard, sideboard);

      req.flash(
        'success',
        'Deck uploaded successfully. Draft not found, a new draft has been created and associated with this record.',
      );
      return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
    }

    // if this draft already has a deck for this user, we don't want to overwrite it
    if (draft.seats[userIndex - 1]?.mainboard?.flat(3).length > 0) {
      req.flash('danger', 'This user already has a deck associated with this draft.');
      return redirect(req, res, `/cube/records/uploaddeck/${record.id}`);
    }

    await associateWithExistingDraft(cube, draft, userIndex, mainboard, sideboard);

    req.flash('success', 'Deck uploaded successfully. Draft associated with this record has been updated.');
    return redirect(req, res, `/cube/record/${req.params.id}?tab=1`);
  } catch (err: unknown) {
    return handleRouteError(req, res, err, `/cube/records/uploaddeck/${req.params.id}`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, ensureAuth, uploadDeckPageHandler],
  },
  {
    method: 'post',
    path: '/:id',
    handler: [
      csrfProtection,
      ensureAuth,
      bodyValidation(mainboardSchema, (req) => `/cube/records/uploaddeck/${req.params.id}`, 'mainboard'),
      bodyValidation(sideboardSchema, (req) => `/cube/records/uploaddeck/${req.params.id}`, 'sideboard'),
      uploadDeckHandler,
    ],
  },
];
