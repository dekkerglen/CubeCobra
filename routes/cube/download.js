const express = require('express');
// eslint-disable-next-line import/no-unresolved

const sortutil = require('../../dist/utils/Sort');
const filterutil = require('../../dist/filtering/FilterCards');
const carddb = require('../../serverjs/cards');
const util = require('../../serverjs/util');

const { buildIdQuery, isCubeViewable } = require('../../serverjs/cubefn');
const { writeCard, CSV_HEADER, exportToMtgo } = require('./helper');

// Bring in models
const Cube = require('../../dynamo/models/cube');

const router = express.Router();

const sortCardsByQuery = (req, cards) => {
  if (req.query.filter) {
    const { filter, err } = filterutil.makeFilter(req.query.filter);
    if (err) {
      throw err;
    }
    if (filter) {
      cards = cards.filter(filter);
    }
  }

  return sortutil.sortForDownload(
    cards,
    req.query.primary,
    req.query.secondary,
    req.query.tertiary,
    req.query.quaternary,
    req.query.showother,
  );
};

router.get('/cubecobra/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const cards = await Cube.getCards(req.params.id);
    const mainboard = cards.boards.find((b) => b.name === 'Mainboard');

    for (const card of mainboard.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    mainboard.cards = sortCardsByQuery(req, mainboard.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.Name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of mainboard.cards) {
      res.write(`${card.details.full_name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/csv/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const cards = await Cube.getCards(req.params.id);
    const mainboard = cards.boards.find((b) => b.name === 'Mainboard') || [];
    const maybeboard = cards.boards.find((b) => b.name === 'Maybeboard') || [];

    for (const card of [...mainboard.cards, ...maybeboard.cards]) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    mainboard.cards = sortCardsByQuery(req, mainboard.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.Name.replace(/\W/g, '')}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);

    for (const card of mainboard.cards) {
      writeCard(res, card, false);
    }
    for (const card of maybeboard.cards) {
      writeCard(res, card, true);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/forge/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const cards = await Cube.getCards(req.params.id);
    const mainboard = cards.boards.find((b) => b.name === 'Mainboard') || [];

    for (const card of mainboard.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    mainboard.cards = sortCardsByQuery(req, mainboard.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.Name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${cube.Name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of mainboard.cards) {
      res.write(`1 ${card.details.name}|${card.details.set.toUpperCase()}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/mtgo/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const cards = await Cube.getCards(req.params.id);
    const mainboard = cards.boards.find((b) => b.name === 'Mainboard') || [];
    const maybeboard = cards.boards.find((b) => b.name === 'Maybeboard') || [];

    for (const card of mainboard.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    mainboard.cards = sortCardsByQuery(req, mainboard.cards);

    return exportToMtgo(res, cube.Name, mainboard.cards, maybeboard.cards);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/xmage/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const cards = await Cube.getCards(req.params.id);
    const mainboard = cards.boards.find((b) => b.name === 'Mainboard') || [];

    for (const card of mainboard.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    mainboard.cards = sortCardsByQuery(req, mainboard.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.Name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of mainboard.cards) {
      res.write(`1 [${card.details.set.toUpperCase()}:${card.details.collector_number}] ${card.details.name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/plaintext/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const cards = await Cube.getCards(req.params.id);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    for (const board of cards.boards) {
      for (const card of board.cards) {
        const details = carddb.cardFromId(card.cardID);
        card.details = details;
      }
      board.cards = sortCardsByQuery(req, board.cards);

      res.write(`# ${board.name}\r\n`);
      for (const card of board.cards) {
        res.write(`${card.details.name}\r\n`);
      }
      res.write(`\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
