import { cubeDao, draftDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { addBasics, createPool, shuffle } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';
import { DRAFT_TYPES } from '@utils/datatypes/Draft';

export const startGridDraftHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      req.flash('danger', 'You must be logged in to start a draft.');
      return redirect(req, res, `/cube/playtest/${req.params.id}`);
    }

    const numPacks = parseInt(req.body.packs, 10);

    const numCards = numPacks * 9;

    const cube = await cubeDao.getById(req.params.id!);
    const cubeCards = await cubeDao.getCards(req.params.id!);
    const { mainboard } = cubeCards;

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (mainboard.length < numCards) {
      req.flash('danger', `Not enough cards, need ${numCards} cards for a ${numPacks} pack grid draft.`);
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    const source = shuffle(mainboard)
      .slice(0, numCards)
      .map((card: any, index) => {
        card.index = index;
        return card;
      });

    const doc = {
      cube: cube.id,
      owner: req.user.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      type: DRAFT_TYPES.GRID,
      seats: [],
      cards: [],
      InitialState: [],
      complete: false,
    } as any;

    for (let i = 0; i < numPacks; i++) {
      const pack = source.splice(0, 9);
      doc.cards.push(...pack);
      doc.InitialState.push(pack.map((card: any) => card.index));
    }

    addBasics(doc, cube.basics);
    const pool = createPool();

    // add human
    doc.seats.push({
      bot: false,
      name: req.user ? req.user.username : 'Anonymous',
      owner: req.user ? req.user.id : null,
      mainboard: pool,
      sideboard: pool,
      pickorder: [],
      pickedIndices: [],
    });

    if (req.body.type === '2playerlocal') {
      // add human
      doc.seats.push({
        bot: false,
        name: req.user ? req.user.username : 'Anonymous',
        owner: req.user ? req.user.id : null,
        mainboard: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });
    } else {
      // add bot
      doc.seats.push({
        bot: true,
        name: 'Grid Bot',
        owner: null,
        mainboard: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });
    }

    const id = await draftDao.createDraft(doc);

    return redirect(req, res, `/cube/griddraft/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post' as const,
    handler: [
      body('packs').toInt().isInt({ min: 1, max: 16 }),
      body('type', 'type must be valid.').isIn(['bot', '2playerlocal']),
      startGridDraftHandler,
    ],
  },
];
