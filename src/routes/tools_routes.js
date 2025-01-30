// Load Environment Variables
require('dotenv').config();

const express = require('express');

import { Period } from '../datatypes/History';
import carddb, {
  cardFromId,
  getAllMostReasonable,
  getEnglishVersion,
  getIdsFromName,
  getMostReasonable,
  getMostReasonableById,
  getReasonableCardByOracle,
  getRelatedCards,
} from '../util/carddb';
const cardutil = require('../client/utils/cardutil');
const { SortFunctionsOnDetails, ORDERED_SORTS } = require('../client/utils/Sort');
const { makeFilter, filterCardsDetails } = require('../client/filtering/FilterCards');
const generateMeta = require('../util/meta');
const util = require('../util/util');
const { csrfProtection } = require('./middleware');
const { render, redirect } = require('../util/render');

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
    cards.push(...getAllMostReasonable(filter));
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
    const ids = getIdsFromName(possibleName);
    if (ids) {
      id = getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    // otherwise just go to this ID.
    const history = await CardHistory.getByOracleAndType(card.oracle_id, Period.WEEK, 52);

    if (history.items.length === 0) {
      history.items.push({});
    }

    const related = getRelatedCards(card.oracle_id);

    const baseUrl = util.getBaseUrl();
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
          .map((cardid) => cardFromId(cardid)),
        draftedWith: related.draftedWith,
        cubedWith: related.cubedWith,
        synergistic: related.synergistic,
      },
      {
        title: `${card.name}`,
        metadata: generateMeta(
          `${card.name} - Cube Cobra`,
          `Analytics for ${card.name} on CubeCobra`,
          card.image_normal,
          `${baseUrl}/card/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console -- Error debugging
    console.error(err);
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardjson/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = getIdsFromName(possibleName);
    if (ids) {
      id = getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    // otherwise just go to this ID.
    const history = await CardHistory.getByOracleAndType(card.oracle_id, Period.WEEK, 52);

    if (history.items.length === 0) {
      history.items.push({});
    }

    const related = getRelatedCards(card.oracle_id);

    return res.json({
      card,
      history: history.items.reverse(),
      lastKey: history.lastKey,
      versions: carddb.oracleToId[card.oracle_id]
        .filter((cid) => cid !== card.scryfall_id)
        .map((cardid) => cardFromId(cardid)),
      draftedWith: related.draftedWith,
      cubedWith: related.cubedWith,
      synergistic: related.synergistic,
    });
  } catch (err) {
    return res.json({ error: err.message });
  }
});

router.get('/cardimage/:id', async (req, res) => {
  try {
    let { id } = req.params;

    const defaultPrinting = req?.query?.defaultPrinting;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = getIdsFromName(possibleName);
    if (ids) {
      id = getMostReasonable(possibleName, defaultPrinting).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 month
      return redirect(req, res, '/content/default_card.png');
    }

    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 month
    return redirect(req, res, card.image_normal);
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 year
    return redirect(req, res, '/content/default_card.png');
  }
});

router.get('/cardimageforcube/:id/:cubeid', async (req, res) => {
  try {
    const { id } = req.params;

    const cards = await Cube.getCards(req.params.cubeid);

    const main = cards.mainboard;

    const found = main
      .map((card) => ({ details: cardFromId(card.cardID), ...card }))
      .find(
        (card) => id === card.cardID || id.toLowerCase() === card.details.name_lower || id === card.details.oracleId,
      );

    // if id is not a scryfall ID, error
    const card = cardFromId(found ? found.cardID : '');
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    return redirect(req, res, card.image_normal);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardimageflip/:id', async (req, res) => {
  try {
    let { id } = req.params;

    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = getIdsFromName(possibleName);
    if (ids) {
      id = getMostReasonable(possibleName).scryfall_id;
    }

    // if id is a foreign id, redirect to english version
    const english = getEnglishVersion(id);
    if (english) {
      id = english;
    }

    // if id is an oracle id, redirect to most reasonable scryfall
    if (carddb.oracleToId[id]) {
      id = getMostReasonableById(carddb.oracleToId[id][0]).scryfall_id;
    }

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    return redirect(req, res, card.image_flip);
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

  const cards = oracles.map((oracle) => getReasonableCardByOracle(oracle));

  const result = [];

  for (const card of cards) {
    const related = getRelatedCards(card.oracle_id);
    const synergistic = related.synergistic.top.map((oracle) => getReasonableCardByOracle(oracle));

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
