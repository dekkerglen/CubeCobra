// Load Environment Variables
require('dotenv').config();

const express = require('express');

const carddb = require('../serverjs/carddb');
const cardutil = require('../dist/utils/Card');
const { SortFunctionsOnDetails, ORDERED_SORTS } = require('../dist/utils/Sort');
const { makeFilter, filterCardsDetails } = require('../dist/filtering/FilterCards');
const generateMeta = require('../serverjs/meta');
const util = require('../serverjs/util');
const { csrfProtection } = require('./middleware');
const { render } = require('../serverjs/render');

const CardHistory = require('../dynamo/models/cardhistory');
const Cube = require('../dynamo/models/cube');

const router = express.Router();

router.use(csrfProtection);

/* Minimum number of picks for data to show up in Top cards list. */
const MIN_PICKS = 100;
/* Page size for results */
const PAGE_SIZE = 96;

const searchCards = (filter, sort = 'Elo', page = 0, direction = 'descending', distinct = 'names') => {
  const cards = [];

  if (distinct === 'names') {
    cards.push(...carddb.getAllMostReasonable(filter));
  } else {
    cards.push(...filterCardsDetails(carddb.printedCardList, filter));
  }

  if (ORDERED_SORTS.includes(sort)) {
    cards.sort(SortFunctionsOnDetails(sort));
  }

  if (direction === 'descending') {
    cards.reverse();
  }

  page = parseInt(page, 10);

  return {
    numResults: cards.length,
    data: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
  };
};

router.get('/api/topcards', async (req, res) => {
  try {
    const { err, filter } = makeFilter(`${req.query.f}`);
    if (err) {
      res.status(400).send({
        success: 'false',
        numResults: 0,
        data: [],
      });
      return;
    }

    const { data, numResults } = searchCards(filter, req.query.s, parseInt(req.query.p, 10), req.query.d);
    res.status(200).send({
      success: 'true',
      data,
      numResults,
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    res.status(500).send({
      success: 'false',
      numResults: 0,
      data: [],
    });
  }
});

router.get('/api/searchcards', async (req, res) => {
  try {
    const { err, filter } = makeFilter(req.query.f);
    if (err) {
      res.status(400).send({
        success: 'false',
        numResults: 0,
        data: [],
      });
      return;
    }
    const { data, numResults } = searchCards(filter, req.query.s, req.query.p, req.query.d, req.query.di);
    res.status(200).send({
      success: 'true',
      data,
      numResults,
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    res.status(500).send({
      success: 'false',
      numResults: 0,
      data: [],
    });
  }
});

router.get('/topcards', async (req, res) => {
  try {
    const { filter } = makeFilter(`pickcount>=${MIN_PICKS} ${req.query.f}`);
    const { data, numResults } = await searchCards(filter, req.query.s, parseInt(req.query.p, 10), req.query.d);

    return render(
      req,
      res,
      'TopCardsPage',
      {
        data,
        numResults,
      },
      {
        title: 'Top cards',
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/cardhistory', async (req, res) => {
  try {
    const { id, zoom, period } = req.body;

    let zoomValue = 10000;

    if (zoom === 'month') {
      switch (period) {
        case 'day':
          zoomValue = 30;
          break;
        case 'week':
          zoomValue = 4;
          break;
        case 'month':
          zoomValue = 2;
          break;
        default:
          zoomValue = 0;
          break;
      }
    } else if (zoom === 'year') {
      switch (period) {
        case 'day':
          zoomValue = 365;
          break;
        case 'week':
          zoomValue = 52;
          break;
        case 'month':
          zoomValue = 12;
          break;
        default:
          zoomValue = 0;
          break;
      }
    }

    const history = await CardHistory.getByOracleAndType(id, period, zoomValue);

    return res.status(200).send({
      success: 'true',
      data: history.items.reverse(),
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
      data: [],
    });
  }
});

router.get('/card/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      id = carddb.getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return res.redirect('/404');
    }

    // otherwise just go to this ID.
    const history = await CardHistory.getByOracleAndType(card.oracle_id, CardHistory.TYPES.WEEK, 52);

    if (history.items.length === 0) {
      history.items.push({});
    }

    const related = carddb.getRelatedCards(card.oracle_id);

    const draftedWith = {};
    const cubedWith = {};
    const synergistic = {};

    for (const category of ['top', 'spells', 'creatures', 'other']) {
      draftedWith[category] = related.draftedWith[category].map((oracle) => carddb.getReasonableCardByOracle(oracle));
      cubedWith[category] = related.cubedWith[category].map((oracle) => carddb.getReasonableCardByOracle(oracle));
      synergistic[category] = related.synergistic[category].map((oracle) => carddb.getReasonableCardByOracle(oracle));
    }

    return render(
      req,
      res,
      'CardPage',
      {
        card,
        history: history.items.reverse(),
        lastKey: history.lastKey,
        versions: carddb.oracleToId[card.oracle_id]
          .filter((cid) => cid !== card.scryfall_id)
          .map((cardid) => carddb.cardFromId(cardid)),
        draftedWith,
        cubedWith,
        synergistic,
      },
      {
        title: `${card.name}`,
        metadata: generateMeta(
          `${card.name} - Cube Cobra`,
          `Analytics for ${card.name} on CubeCobra`,
          card.image_normal,
          `https://cubecobra.com/card/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardjson/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      id = carddb.getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return res.redirect('/404');
    }

    // otherwise just go to this ID.
    const history = await CardHistory.getByOracleAndType(card.oracle_id, CardHistory.TYPES.WEEK, 52);

    if (history.items.length === 0) {
      history.items.push({});
    }

    const related = carddb.getRelatedCards(card.oracle_id);

    const draftedWith = {};
    const cubedWith = {};
    const synergistic = {};

    for (const category of ['top', 'spells', 'creatures', 'other']) {
      draftedWith[category] = related.draftedWith[category].map((oracle) => carddb.getReasonableCardByOracle(oracle));
      cubedWith[category] = related.cubedWith[category].map((oracle) => carddb.getReasonableCardByOracle(oracle));
      synergistic[category] = related.synergistic[category].map((oracle) => carddb.getReasonableCardByOracle(oracle));
    }

    return res.json({
      card,
      history: history.items.reverse(),
      lastKey: history.lastKey,
      versions: carddb.oracleToId[card.oracle_id]
        .filter((cid) => cid !== card.scryfall_id)
        .map((cardid) => carddb.cardFromId(cardid)),
      draftedWith,
      cubedWith,
      synergistic,
    });
  } catch (err) {
    return res.json({ error: err.message });
  }
});

router.get('/cardimage/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      id = carddb.getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(id);
    if (card.error) {
      return res.redirect('/content/default_card.png');
    }

    return res.redirect(card.image_normal);
  } catch {
    return res.redirect('/content/default_card.png');
  }
});

router.get('/cardimageforcube/:id/:cubeid', async (req, res) => {
  try {
    const { id } = req.params;

    const cards = await Cube.getCards(req.params.cubeid);

    const main = cards.mainboard;

    const found = main
      .map((card) => ({ details: carddb.cardFromId(card.cardID), ...card }))
      .find(
        (card) => id === card.cardID || id.toLowerCase() === card.details.name_lower || id === card.details.oracleId,
      );

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(found ? found.cardID : '');
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return res.redirect('/404');
    }

    return res.redirect(card.image_normal);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardimageflip/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      id = carddb.getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return res.redirect('/404');
    }

    return res.redirect(card.image_flip);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/searchcards', async (req, res) =>
  render(
    req,
    res,
    'CardSearchPage',
    {},
    {
      title: 'Search cards',
    },
  ),
);

router.post('/mtgconnect', async (req, res) => {
  const { oracles } = req.body;

  const cards = oracles.map((oracle) => carddb.getReasonableCardByOracle(oracle));

  const result = [];

  for (const card of cards) {
    const related = carddb.getRelatedCards(card.oracle_id);
    const synergistic = related.synergistic.top.map((oracle) => carddb.getReasonableCardByOracle(oracle));

    result.push({
      name: card.name,
      image_normal: card.image_normal,
      oracle: card.oracle_id,
      popularity: card.cubeCount,
      synergistic: synergistic.slice(0, 5).map((c) => ({
        name: c.name,
        image_normal: c.image_normal,
        oracle: c.oracle_id,
      })),
    });
  }

  return res.status(200).send({
    success: 'true',
    cards: result,
  });
});

module.exports = router;
