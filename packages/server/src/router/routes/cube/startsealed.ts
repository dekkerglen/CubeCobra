import * as cardutil from '@utils/cardutil';
import Cube from 'dynamo/models/cube';
import Draft from 'dynamo/models/draft';
import User from 'dynamo/models/user';
import { body } from 'express-validator';
import { cardFromId } from 'serverutils/carddb';
import { addBasics, createPool, shuffle } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const startSealedHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      req.flash('danger', 'You must be logged in to start a sealed draft.');
      return redirect(req, res, `/cube/playtest/${req.params.id}`);
    }

    const user = await User.getById(req.user.id);

    if (!user) {
      req.flash('danger', 'Please Login to build a sealed deck.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    const packs = parseInt(req.body.packs, 10);
    const cards = parseInt(req.body.cards, 10);

    const numCards = packs * cards;

    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cubeCards = await Cube.getCards(req.params.id!);
    const { mainboard } = cubeCards;

    if (mainboard.length < numCards) {
      req.flash('danger', `Not enough cards, need ${numCards} cards for sealed with ${packs} packs of ${cards}.`);
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    const source = shuffle(mainboard).slice(0, numCards);
    const pool = createPool();
    const cardsArray: any[] = [];
    for (const card of source) {
      let index1 = 0;
      let index2 = 0;

      // sort by color
      const details = cardFromId((card as any).cardID);
      const type = (card as any).type_line || details.type;
      const colors = cardutil.cardColors(card as any);

      if (type.toLowerCase().includes('land')) {
        index1 = 7;
      } else if (colors.length === 1) {
        index1 = ['W', 'U', 'B', 'R', 'G'].indexOf(colors[0]!.toUpperCase());
      } else if (colors.length === 0) {
        index1 = 6;
      } else {
        index1 = 5;
      }

      if (!type.toLowerCase().includes('creature')) {
        index2 = 1;
      }

      const cardIndex = cardsArray.length;
      (card as any).index = cardIndex;
      cardsArray.push(card);
      if (pool[index2]?.[index1]) {
        pool[index2]![index1]!.push(cardIndex);
      } else {
        pool[index2]![0]!.push(cardIndex);
      }
    }

    const deck = {
      cube: cube.id,
      owner: req.user.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      type: Draft.TYPES.SEALED,
      seats: [],
      cards: cardsArray,
      complete: true,
    } as any;

    addBasics(deck, cube.basics);

    deck.seats.push({
      owner: user.id,
      title: `Sealed from ${cube.name}`,
      body: '',
      mainboard: pool,
      sideboard: createPool(),
    });

    const deckId = await Draft.put(deck);

    cube.numDecks += 1;

    const cubeOwner = cube.owner;
    await Cube.update(cube);

    if (!cube.disableAlerts && cubeOwner) {
      await addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deckId}`,
        `${user.username} built a sealed deck from your cube: ${cube.name}`,
      );
    }

    return redirect(req, res, `/draft/deckbuilder/${deckId}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post' as const,
    handler: [body('packs').toInt().isInt({ min: 1, max: 16 }), body('cards').toInt(), startSealedHandler],
  },
];
