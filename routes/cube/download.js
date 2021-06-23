const express = require('express');
// eslint-disable-next-line import/no-unresolved
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const sortutil = require('../../dist/utils/Sort.js');
const filterutil = require('../../dist/filtering/FilterCards.js');
const carddb = require('../../serverjs/cards.js');
const util = require('../../serverjs/util.js');

const { buildIdQuery } = require('../../serverjs/cubefn.js');
const { writeCard, CSV_HEADER, exportToMtgo } = require('./helper.js');

// Bring in models
const Cube = require('../../models/cube');

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
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    cube.cards = sortCardsByQuery(req, cube.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${card.details.full_name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/csv/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    cube.cards = sortCardsByQuery(req, cube.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);

    for (const card of cube.cards) {
      writeCard(res, card, false);
    }
    if (Array.isArray(cube.maybe)) {
      for (const card of cube.maybe) {
        writeCard(res, card, true);
      }
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/forge/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    cube.cards = sortCardsByQuery(req, cube.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${cube.name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of cube.cards) {
      res.write(`1 ${card.details.name}|${card.details.set.toUpperCase()}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/mtgo/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    cube.cards = sortCardsByQuery(req, cube.cards);

    return exportToMtgo(res, cube.name, cube.cards, cube.maybe);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/xmage/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    cube.cards = sortCardsByQuery(req, cube.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`1 [${card.details.set.toUpperCase()}:${card.details.collector_number}] ${card.details.name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/plaintext/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }

    cube.cards = sortCardsByQuery(req, cube.cards);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${card.details.name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
