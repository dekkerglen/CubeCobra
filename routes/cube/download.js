const express = require('express');
// eslint-disable-next-line import/no-unresolved
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const sortutil = require('../../dist/utils/Sort.js');
const filterutil = require('../../dist/filtering/FilterCards.js');
const carddb = require('../../serverjs/cards.js');
const util = require('../../serverjs/util.js');

const { buildIdQuery, CSV_HEADER, exportToMtgo } = require('../../serverjs/cubefn.js');
const { writeCard } = require('./helper.js')

// Bring in models
const Cube = require('../../models/cube');

const router = express.Router();

router.get('/cubecobra/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${carddb.cardFromId(card.cardID).full_name}\r\n`);
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

    if (req.query.filter) {
      const { filter, err } = filterutil.makeFilter(req.query.filter);
      if (err) {
        return util.handleRouteError(
          req,
          res,
          'Error parsing filter.',
          `/cube/list/${encodeURIComponent(req.params.id)}`,
        );
      }
      if (filter) {
        cube.cards = cube.cards.filter(filter);
      }
    }

    cube.cards = sortutil.sortForCSVDownload(
      cube.cards,
      req.query.primary,
      req.query.secondary,
      req.query.tertiary,
      req.query.quaternary,
    );

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

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${cube.name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of cube.cards) {
      const { name } = carddb.cardFromId(card.cardID);
      const { set } = carddb.cardFromId(card.cardID);
      res.write(`1 ${name}|${set.toUpperCase()}\r\n`);
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

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      const { name } = carddb.cardFromId(card.cardID);
      const { set } = carddb.cardFromId(card.cardID);
      const collectorNumber = carddb.cardFromId(card.cardID).collector_number;
      res.write(`1 [${set.toUpperCase()}:${collectorNumber}] ${name}\r\n`);
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

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${carddb.cardFromId(card.cardID).name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
