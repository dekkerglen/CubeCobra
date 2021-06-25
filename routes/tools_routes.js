// Load Environment Variables
require('dotenv').config();

const express = require('express');

const { winston } = require('../serverjs/cloudwatch');
const carddb = require('../serverjs/cards');
const cardutil = require('../dist/utils/Card.js');
const { SortFunctionsOnDetails, ORDERED_SORTS } = require('../dist/utils/Sort.js');
const getBlankCardHistory = require('../src/utils/BlankCardHistory.js');
const { makeFilter, filterCardsDetails } = require('../dist/filtering/FilterCards');
const generateMeta = require('../serverjs/meta.js');
const util = require('../serverjs/util.js');
const { render } = require('../serverjs/render');
const { ensureAuth } = require('./middleware');

const CardHistory = require('../models/cardHistory');
const Cube = require('../models/cube');
const Blog = require('../models/blog');

const { buildIdQuery } = require('../serverjs/cubefn.js');

const router = express.Router();

/* Minimum number of picks for data to show up in Top Cards list. */
const MIN_PICKS = 100;
/* Page size for results */
const PAGE_SIZE = 96;

const getAllMostReasonable = (filter) => {
  const cards = filterCardsDetails(carddb.printedCardList, filter);

  const keys = new Set();
  const filtered = [];
  for (const card of cards) {
    if (!keys.has(card.name_lower)) {
      filtered.push(carddb.getMostReasonableById(card._id, 'recent', filter));
      keys.add(card.name_lower);
    }
  }
  return filtered;
};

const searchCards = (filter, sort = 'elo', page = 0, direction = 'descending', distinct = 'names') => {
  const cards = [];

  if (distinct === 'names') {
    cards.push(...getAllMostReasonable(filter));
  } else {
    cards.push(...filterCardsDetails(carddb.printedCardList, filter));
  }

  if (ORDERED_SORTS.includes(sort)) {
    cards.sort(SortFunctionsOnDetails(sort));
  } else {
    winston.info(`Sort function not found: ${sort}`);
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
    const { err, filter } = makeFilter(`pickcount>=${MIN_PICKS} ${req.query.f}`);
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
    req.logger.error(err);
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
    req.logger.error(err);
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
        title: 'Top Cards',
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/randomcard', async (req, res) => {
  const card = carddb.allCards()[Math.floor(Math.random() * carddb.allCards().length)];
  res.redirect(`/tool/card/${card.oracle_id}`);
});

router.get('/card/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      id = carddb.getMostReasonable(possibleName)._id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0])._id;
    }

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return res.redirect('/404');
    }

    // otherwise just go to this ID.
    let data = await CardHistory.findOne({ oracleId: card.oracle_id });
    // id is valid but has no matching history
    if (!data) {
      data = getBlankCardHistory(id);
    }
    const related = {};

    for (const category of ['top', 'synergistic', 'spells', 'creatures', 'other']) {
      related[category] = data.cubedWith[category].map((oracle) =>
        carddb.getMostReasonableById(carddb.oracleToId[oracle][0]),
      );
    }

    return render(
      req,
      res,
      'CardPage',
      {
        card,
        data,
        versions: carddb.oracleToId[card.oracle_id]
          .filter((cid) => cid !== card._id)
          .map((cardid) => carddb.cardFromId(cardid)),
        related,
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

router.get('/cardimage/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      id = carddb.getMostReasonable(possibleName)._id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0])._id;
    }

    // if id is not a scryfall ID, error
    const card = carddb.cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return res.redirect('/404');
    }

    return res.redirect(card.image_normal);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardimageforcube/:id/:cubeid', async (req, res) => {
  try {
    const { id } = req.params;

    const cube = await Cube.findOne(buildIdQuery(req.params.cubeid), 'cards').lean();

    const found = cube.cards
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
      id = carddb.getMostReasonable(possibleName)._id;
    }

    // if id is a foreign id, redirect to english version
    const english = carddb.getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = carddb.getMostReasonableById(carddb.oracleToId[id][0])._id;
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

router.get('/searchcards', async (req, res) => {
  return render(
    req,
    res,
    'CardSearchPage',
    {},
    {
      title: 'Search Cards',
    },
  );
});

router.get('/getfeeditems/:skip', ensureAuth, async (req, res) => {
  const items = await Blog.find({
    $or: [
      {
        cube: {
          $in: req.user.followed_cubes,
        },
      },
      {
        owner: {
          $in: req.user.followed_users,
        },
      },
      {
        dev: 'true',
      },
    ],
  })
    .sort({
      date: -1,
    })
    .skip(parseInt(req.params.skip, 10))
    .limit(10);

  return res.status(200).send({
    success: 'true',
    items,
  });
});

module.exports = router;
