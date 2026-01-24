import { cardOracleId } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import CubeType from '@utils/datatypes/Cube';
import DraftType, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { setupPicks } from '@utils/draftutil';
import { Draft } from 'dynamo/dao/DraftDynamoDao';
import { RecordEntity } from 'dynamo/dao/RecordDynamoDao';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation } from 'router/middleware';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { cardFromId, getReasonableCardByOracle, getVersionsByOracleId } from 'serverutils/carddb';
import { addBasics, createPool } from 'serverutils/cube';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../../types/express';

export const uploadDeckPageHandler = async (req: Request, res: Response) => {
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

    let draft: DraftType | undefined;
    if (record.draft) {
      draft = await draftDao.getById(record.draft);
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

export const associateNewDraft = async (
  cube: CubeType,
  record: RecordEntity,
  userIndex: number,
  mainboardOracles: string[],
  sideboardOracles: string[] = [],
) => {
  const cubeCards = await cubeDao.getCards(cube.id);
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
      if (selectedId) {
        selected = {
          cardID: selectedId,
          details: cardFromId(selectedId),
        };
      }
    }

    if (selected) {
      const isCreature = selected.details.type.toLowerCase().includes('creature');
      const cmc = selected.details.cmc;

      const row = isSideboard ? 0 : isCreature ? 0 : 1;
      const col = Math.max(0, Math.min(7, Math.floor(cmc)));

      if (targetPool[row] && targetPool[row][col]) {
        targetPool[row][col].push(cards.length);
        cards.push(selected);
      }
    }
  };

  for (const oracle of mainboardOracles) {
    processCard(oracle, deck, false);
  }

  for (const oracle of sideboardOracles) {
    processCard(oracle, sideboard, true);
  }

  // Ensure all cards have index and type_line set
  const cardsWithIndex = cards.map((card, index) => ({
    ...card,
    index: card.index ?? index,
    type_line: card.type_line || card.details?.type || '',
  }));

  const newDraft = {
    cube: cube.id,
    owner: cube.owner.id,
    cubeOwner: cube.owner.id,
    date: record.date,
    type: DRAFT_TYPES.UPLOAD,
    cards: cardsWithIndex,
    seats: record.players.map((player) => ({
      owner: player.userId,
      title: `${player.name}`,
      mainboard: createPool() as number[][][],
      sideboard: setupPicks(1, 8) as number[][][],
    })),
    complete: true,
    basics: [] as number[], // Will be populated by addBasics
  };

  const targetSeat = newDraft.seats[userIndex - 1];
  if (targetSeat) {
    targetSeat.mainboard = deck;
    targetSeat.sideboard = sideboard;
  }

  // addBasics modifies the draft object in place, adding basic cards to cards array
  // and setting basics to be an array of card indices
  addBasics(newDraft, cube.basics);

  const id = await draftDao.createDraft(newDraft);

  cube.numDecks += 1;
  await cubeDao.update(cube, { skipTimestampUpdate: true });

  record.draft = id;
  record.dateLastUpdated = Date.now();
  // Update the record with the draft ID
  await recordDao.update(record);
};

export const associateWithExistingDraft = async (
  cube: CubeType,
  draft: Draft,
  userIndex: number,
  mainboardOracles: string[],
  sideboardOracles: string[] = [],
) => {
  const cubeCards = await cubeDao.getCards(cube.id);
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
      if (selectedId) {
        selected = {
          cardID: selectedId,
          details: cardFromId(selectedId),
        };
      }
    }

    if (selected) {
      const isCreature = selected.details.type.toLowerCase().includes('creature');
      const cmc = selected.details.cmc;

      const row = isSideboard ? 0 : isCreature ? 0 : 1;
      const col = Math.max(0, Math.min(7, Math.floor(cmc)));

      // Check if card already exists to prevent unbounded array growth
      const existingIndex = cards.findIndex((c) => c.cardID === selected.cardID);
      const cardIndex = existingIndex >= 0 ? existingIndex : cards.length;

      if (targetPool[row] && targetPool[row][col]) {
        targetPool[row][col].push(cardIndex);
        // Only add card if it doesn't already exist
        if (existingIndex < 0) {
          cards.push(selected);
        }
      }
    }
  };

  for (const oracle of mainboardOracles) {
    processCard(oracle, deck, false);
  }

  for (const oracle of sideboardOracles) {
    processCard(oracle, sideboard, true);
  }

  const targetSeat = draft.seats[userIndex - 1];
  if (targetSeat) {
    targetSeat.mainboard = deck;
    targetSeat.sideboard = sideboard;
  }

  // Update the draft with the new seat data
  await draftDao.update(draft);
};

export const uploadDeckHandler = async (req: Request, res: Response) => {
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
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

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

    const draft = await draftDao.getById(record.draft);

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
    const userSeat = draft.seats[userIndex - 1];
    if (userSeat?.mainboard && userSeat.mainboard.flat(3).length > 0) {
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
