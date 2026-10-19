import { cardCollectorNumber, cardName, cardSet } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import Cube, { CubeCards } from '@utils/datatypes/Cube';
import filterutil, { FilterFunction, MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import { sortForDownload } from '@utils/sorting/Sort';
import { cubeDao } from 'dynamo/daos';
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { cardFromId } from 'serverutils/carddb';
import { CSV_HEADER, exportToMtgo, writeCard } from 'serverutils/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { expensiveGetLimiter } from 'serverutils/rateLimiters';
import { handleRouteError, redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

/**
 * Determine which boards to export from query params.
 * - allBoards=1 → all boards
 * - boards=mainboard,maybeboard → specific boards
 * - otherwise → mainboard only
 */
const getBoardsToExport = (req: Request, cards: CubeCards): string[] => {
  if (req.query.allBoards === '1') {
    return Object.keys(cards).filter((k) => k !== 'id');
  }
  if (typeof req.query.boards === 'string' && req.query.boards.length > 0) {
    // Deduplicate: each listed board is filtered and written, so repeats only multiply work.
    return [
      ...new Set(
        req.query.boards
          .split(',')
          .map((b) => b.trim())
          .filter((b) => b && b !== 'id' && cards[b] !== undefined),
      ),
    ];
  }
  // Default: mainboard only
  return ['mainboard'];
};

/**
 * Parses the optional `?filter=` once per request. Throws a user-facing error when it is
 * malformed or too long, before any cube data is loaded.
 */
const getQueryFilter = (req: Request): FilterFunction | null => {
  const filterText = req.query.filter;
  if (!filterText) {
    return null;
  }
  if (typeof filterText !== 'string' || filterText.length > MAX_SEARCH_FILTER_LENGTH) {
    throw new Error('The filter for this download is not valid.');
  }
  const { filter, err } = filterutil.makeFilter(filterText);
  if (err) {
    throw new Error('The filter for this download is not valid.');
  }
  return filter;
};

// Only downloads that carry a filter run the filter parser, so only those are throttled.
const filterLimiter = expensiveGetLimiter(60_000, 30);
const limitFilteredDownloads = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) =>
  req.query.filter ? filterLimiter(req, res, next) : next();

const sortCardsByQuery = (req: Request, cards: Card[], filter: FilterFunction | null, cube: Cube): Card[] => {
  const filteredCards = filter ? cards.filter(filter) : cards;

  // Default to the cube's own "show unsorted" setting so a download matches what the cube page shows.
  // Without this, any card no sort bucket claims - a custom card or voucher with no type line, say -
  // is silently dropped from the export even though the page lists it under "Other". An explicit
  // showother query param still wins, so callers can override either way.
  const showOther = req.query.showother !== undefined ? req.query.showother === 'true' : cube.showUnsorted || false;

  return sortForDownload(
    filteredCards,
    req.query.primary as string | undefined,
    req.query.secondary as string | undefined,
    req.query.tertiary as string | undefined,
    req.query.quaternary as string | undefined,
    showOther,
    cube,
  );
};

export const cubecobraHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const filter = getQueryFilter(req);

    const cube = await cubeDao.getById(req.params.id);
    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const boardsToExport = getBoardsToExport(req, cards);

    let allCards: Card[] = [];
    for (const boardKey of boardsToExport) {
      const boardCards = cards[boardKey];
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards as Card[]) {
        card.details = cardFromId(card.cardID);
      }
      allCards = allCards.concat(boardCards as Card[]);
    }

    allCards = sortCardsByQuery(req, allCards, filter, cube);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of allCards) {
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

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);

    // Determine which boards to export
    const boardsToExport = getBoardsToExport(req, cards);

    // Ensure all cards have details populated
    for (const boardKey of boardsToExport) {
      const boardCards = cards[boardKey];
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards as Card[]) {
        if (!card.details) {
          card.details = cardFromId(card.cardID);
        }
      }
    }

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);

    // Write boards in order
    for (const boardKey of boardsToExport) {
      const boardCards = cards[boardKey];
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards as Card[]) {
        writeCard(res, card, boardKey);
      }
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

    const filter = getQueryFilter(req);

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const boardsToExport = getBoardsToExport(req, cards);

    let allCards: Card[] = [];
    for (const boardKey of boardsToExport) {
      const boardCards = cards[boardKey];
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards as Card[]) {
        card.details = cardFromId(card.cardID);
      }
      allCards = allCards.concat(boardCards as Card[]);
    }

    allCards = sortCardsByQuery(req, allCards, filter, cube);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`name=${cube.name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of allCards) {
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

    const filter = getQueryFilter(req);

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const boardsToExport = getBoardsToExport(req, cards);

    let allCards: Card[] = [];
    for (const boardKey of boardsToExport) {
      const boardCards = cards[boardKey];
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards as Card[]) {
        card.details = cardFromId(card.cardID);
      }
      allCards = allCards.concat(boardCards as Card[]);
    }

    allCards = sortCardsByQuery(req, allCards, filter, cube);

    // MTGO format uses main/side split; put all selected boards in main
    return exportToMtgo(res, cube.name, allCards, []);
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

    const filter = getQueryFilter(req);

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const boardsToExport = getBoardsToExport(req, cards);

    let allCards: Card[] = [];
    for (const boardKey of boardsToExport) {
      const boardCards = cards[boardKey];
      if (!Array.isArray(boardCards)) continue;
      for (const card of boardCards as Card[]) {
        card.details = cardFromId(card.cardID);
      }
      allCards = allCards.concat(boardCards as Card[]);
    }

    allCards = sortCardsByQuery(req, allCards, filter, cube);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of allCards) {
      res.write(`1 [${cardSet(card).toUpperCase()}:${cardCollectorNumber(card)}] ${cardName(card)}\r\n`);
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const versionedHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const filter = getQueryFilter(req);

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);

    const boardsToExport = getBoardsToExport(req, cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    for (const boardname of boardsToExport) {
      const list = cards[boardname];
      if (!Array.isArray(list)) continue;
      for (const card of list as Card[]) {
        const details = cardFromId(card.cardID);
        card.details = details;
      }
      const sorted = sortCardsByQuery(req, list as Card[], filter, cube);

      // Put all selected boards in main
      // Moxfield/Archidekt/Draftmancer all use different rules
      for (const card of sorted) {
        // Possible card formats:
        // 1 Cardname
        // 1 Cardname (SET)
        // 1 Cardname (SET) 123
        const set = cardSet(card).toUpperCase();
        const collectorNumber = cardCollectorNumber(card);

        let line = `1 ${cardName(card)}`;
        if (set) {
          line += ` (${set})`;
          if (collectorNumber) {
            line += ` ${collectorNumber}`;
          }
        }

        res.write(`${line}\r\n`);
      }

      res.write(`\r\n`);
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

    const filter = getQueryFilter(req);

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);

    // Determine which boards to export
    const boardsToExport = getBoardsToExport(req, cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    for (const boardname of boardsToExport) {
      const list = cards[boardname];
      if (!Array.isArray(list)) continue;
      for (const card of list as Card[]) {
        const details = cardFromId(card.cardID);
        card.details = details;
      }
      const sorted = sortCardsByQuery(req, list as Card[], filter, cube);

      res.write(`# ${boardname}\r\n`);
      for (const card of sorted) {
        res.write(`${cardName(card)}\r\n`);
      }
      res.write(`\r\n`);
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
    handler: [limitFilteredDownloads, cubecobraHandler],
  },
  {
    path: '/csv/:id',
    method: 'get',
    handler: [csvHandler],
  },
  {
    path: '/forge/:id',
    method: 'get',
    handler: [limitFilteredDownloads, forgeHandler],
  },
  {
    path: '/mtgo/:id',
    method: 'get',
    handler: [limitFilteredDownloads, mtgoHandler],
  },
  {
    path: '/xmage/:id',
    method: 'get',
    handler: [limitFilteredDownloads, xmageHandler],
  },
  {
    path: '/versioned/:id',
    method: 'get',
    handler: [limitFilteredDownloads, versionedHandler],
  },
  {
    path: '/plaintext/:id',
    method: 'get',
    handler: [limitFilteredDownloads, plaintextHandler],
  },
];
