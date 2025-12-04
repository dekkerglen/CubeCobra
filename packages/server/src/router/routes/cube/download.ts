import { sortForDownload } from '@utils/sorting/Sort';
import { cardCollectorNumber, cardName, cardSet } from '@utils/cardutil';
import filterutil from '@utils/filtering/FilterCards';
import { cardFromId } from '../../../serverutils/carddb';
import { isCubeViewable } from '../../../serverutils/cubefn';
import { CSV_HEADER, exportToMtgo, writeCard } from '../../../serverutils/cube';
import { handleRouteError, redirect } from '../../../serverutils/render';
import Cube from 'dynamo/models/cube';
import { Request, Response } from '../../../types/express';
import Card from '@utils/datatypes/Card';

const sortCardsByQuery = (req: Request, cards: Card[]): Card[] => {
  let filteredCards = cards;

  if (req.query.filter) {
    const { filter, err } = filterutil.makeFilter(req.query.filter as string);
    if (err) {
      throw err;
    }
    if (filter) {
      filteredCards = cards.filter(filter);
    }
  }

  return sortForDownload(
    filteredCards,
    req.query.primary as string | undefined,
    req.query.secondary as string | undefined,
    req.query.tertiary as string | undefined,
    req.query.quaternary as string | undefined,
    req.query.showother === 'true', // Coerce string parameter to boolean
  );
};

export const cubecobraHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(req.params.id);
    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    let { mainboard } = cards;

    for (const card of mainboard) {
      const details = cardFromId(card.cardID);
      card.details = details;
    }

    mainboard = sortCardsByQuery(req, mainboard);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of mainboard) {
      res.write(`${cardName(card)}\r\n`);
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const csvHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    let { mainboard } = cards;
    const { maybeboard } = cards;

    for (const card of [...mainboard, ...maybeboard]) {
      const details = cardFromId(card.cardID);
      card.details = details;
    }

    mainboard = sortCardsByQuery(req, mainboard);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);

    for (const card of mainboard) {
      writeCard(res, card, false);
    }
    for (const card of maybeboard) {
      writeCard(res, card, true);
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const forgeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    let { mainboard } = cards;

    for (const card of mainboard) {
      const details = cardFromId(card.cardID);
      card.details = details;
    }

    mainboard = sortCardsByQuery(req, mainboard);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`name=${cube.name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of mainboard) {
      res.write(`1 ${cardName(card)}|${cardSet(card).toUpperCase()}\r\n`);
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const mtgoHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    let { mainboard } = cards;
    const { maybeboard } = cards;

    for (const card of mainboard) {
      const details = cardFromId(card.cardID);
      card.details = details;
    }

    mainboard = sortCardsByQuery(req, mainboard);

    return exportToMtgo(res, cube.name, mainboard, maybeboard);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const xmageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    let { mainboard } = cards;

    for (const card of mainboard) {
      const details = cardFromId(card.cardID);
      card.details = details;
    }

    mainboard = sortCardsByQuery(req, mainboard);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of mainboard) {
      res.write(`1 [${cardSet(card).toUpperCase()}:${cardCollectorNumber(card)}] ${cardName(card)}\r\n`);
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const plaintextHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    for (const [boardname, list] of Object.entries(cards)) {
      if (boardname !== 'id') {
        for (const card of list as Card[]) {
          const details = cardFromId(card.cardID);
          card.details = details;
        }
        const sorted = sortCardsByQuery(req, list as Card[]);

        res.write(`# ${boardname}\r\n`);
        for (const card of sorted) {
          res.write(`${cardName(card)}\r\n`);
        }
        res.write(`\r\n`);
      }
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '/cubecobra/:id',
    method: 'get',
    handler: [cubecobraHandler],
  },
  {
    path: '/csv/:id',
    method: 'get',
    handler: [csvHandler],
  },
  {
    path: '/forge/:id',
    method: 'get',
    handler: [forgeHandler],
  },
  {
    path: '/mtgo/:id',
    method: 'get',
    handler: [mtgoHandler],
  },
  {
    path: '/xmage/:id',
    method: 'get',
    handler: [xmageHandler],
  },
  {
    path: '/plaintext/:id',
    method: 'get',
    handler: [plaintextHandler],
  },
];
