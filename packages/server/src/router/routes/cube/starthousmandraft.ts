import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { cubeDao, draftDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { addBasics, createPool, getBasicsFromCube, shuffle } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

// Standard Housman Draft parameters. Only player count and round count are configurable
// from the UI; hand size, face-up pool size, and exchanges-per-round are fixed to the
// standard format (see https://luckypaper.co/resources/formats/housman/).
const HAND_SIZE = 5;
const FACE_UP = 9;

export const startHousmanDraftHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      req.flash('danger', 'You must be logged in to start a draft.');
      return redirect(req, res, `/cube/playtest/${req.params.id}`);
    }

    const numPlayers = parseInt(req.body.players, 10);
    const numRounds = parseInt(req.body.rounds, 10);

    // Each round deals a hand to every player plus the shared face-up pool.
    const cardsPerRound = HAND_SIZE * numPlayers + FACE_UP;
    const numCards = numRounds * cardsPerRound;

    const cube = await cubeDao.getById(req.params.id!);
    const cubeCards = await cubeDao.getCards(req.params.id!);
    const { mainboard } = cubeCards;

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (mainboard.length < numCards) {
      req.flash(
        'danger',
        `Not enough cards, need ${numCards} cards for a ${numRounds} round, ${numPlayers} player Housman draft.`,
      );
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
      type: DRAFT_TYPES.HOUSMAN,
      seats: [],
      cards: [],
      InitialState: [],
      complete: false,
    } as any;

    // Each entry of InitialState is a flat list of card indices for one round: the first
    // HAND_SIZE * numPlayers cards are dealt as hands (HAND_SIZE per seat, in seat order),
    // and the final FACE_UP cards form the shared face-up pool.
    for (let i = 0; i < numRounds; i++) {
      const round = source.splice(0, cardsPerRound);
      doc.cards.push(...round);
      doc.InitialState.push(round.map((card: any) => card.index));
    }

    // Housman draft doesn't use format definitions, so default to "Basics" board
    const basicsToAdd = getBasicsFromCube(cubeCards, 'Basics', cube.basics);
    addBasics(doc, basicsToAdd);

    // Seat 0 is the human; the remaining seats are bots.
    doc.seats.push({
      bot: false,
      name: req.user ? req.user.username : 'Anonymous',
      owner: req.user ? req.user.id : null,
      mainboard: createPool(),
      sideboard: createPool(),
      pickorder: [],
    });

    for (let i = 1; i < numPlayers; i++) {
      doc.seats.push({
        bot: true,
        name: `Housman Bot ${i}`,
        owner: null,
        mainboard: createPool(),
        sideboard: createPool(),
        pickorder: [],
      });
    }

    const id = await draftDao.createDraft(doc);

    return redirect(req, res, `/cube/housmandraft/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post' as const,
    handler: [
      body('players').toInt().isInt({ min: 2, max: 5 }),
      body('rounds').toInt().isInt({ min: 1, max: 15 }),
      startHousmanDraftHandler,
    ],
  },
];
