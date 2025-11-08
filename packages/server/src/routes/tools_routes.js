// Load Environment Variables
require('dotenv').config();

const express = require('express');
import { validate as uuidValidate } from 'uuid';

import { Period } from '@utils/datatypes/History';
import carddb, {
  cardFromId,
  getEnglishVersion,
  getIdsFromName,
  getMostReasonable,
  getMostReasonableById,
  getOracleForMl,
  getRelatedCards,
} from '../util/carddb';
const cardutil = require('@utils/cardutil');
const { makeFilter } = require('@utils/filtering/FilterCards');
const generateMeta = require('../util/meta');
const util = require('../util/util');
const { csrfProtection } = require('./middleware');
const { handleRouteError, render, redirect } = require('../util/render');

const CardHistory = require('../dynamo/models/cardhistory');
const Cube = require('../dynamo/models/cube');

const { searchCards } = require('../util/tools');

const router = express.Router();

router.use(csrfProtection);

/* Minimum number of picks for data to show up in Top cards list. */
const MIN_PICKS = 100;

const chooseIdFromInput = (req) => {
  //ID is scryfall id or a card name (eg. via Autocomplete hover)
  const printingPreference = req?.query?.defaultPrinting || req?.user?.defaultPrinting;
  let { id } = req.params;

  if (!uuidValidate(id)) {
    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(id);
    const ids = getIdsFromName(possibleName);
    if (ids !== undefined && ids.length > 0) {
      id = getMostReasonable(possibleName, printingPreference).scryfall_id;
    }
  }

  // if id is a foreign id, redirect to english version
  const english = getEnglishVersion(id);
  if (english) {
    id = english;
  }

  // if id is an oracle id, redirect to most reasonable scryfall
  if (carddb.oracleToId[id]) {
    id = getMostReasonableById(carddb.oracleToId[id][0], printingPreference).scryfall_id;
  }

  return id;
};

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
    const { data, numResults } = searchCards(
      filter,
      req.query.s,
      req.query.p,
      req.query.d,
      req.query.di,
      req?.user?.defaultPrinting,
    );
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
    const { data, numResults } = await searchCards(
      filter,
      req.query.s,
      parseInt(req.query.p, 10),
      req.query.d,
      'names',
      req?.user?.defaultPrinting,
    );

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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/card/:id', async (req, res) => {
  try {
    const id = chooseIdFromInput(req);

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

    const printingPreference = req?.user?.defaultPrinting;
    const related = getRelatedCards(card.oracle_id, printingPreference);
    const mlSubstitution = getOracleForMl(card.oracle_id, printingPreference);

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CardPage',
      {
        card,
        mlSubstitution: mlSubstitution ? cardFromId(mlSubstitution) : null,
        history: history.items.reverse(),
        lastKey: history.lastKey,
        versions: carddb.oracleToId[card.oracle_id]
          .filter((cid) => cid !== card.scryfall_id)
          .map((cardid) => cardFromId(cardid))
          .filter((c) => !c.isExtra), //Card isExtra if its the preflipped backside
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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardjson/:id', async (req, res) => {
  try {
    const id = chooseIdFromInput(req);

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
    const id = chooseIdFromInput(req);

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
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/cardimageflip/:id', async (req, res) => {
  try {
    const id = chooseIdFromInput(req);

    // if id is not a scryfall ID, error
    const card = cardFromId(id);
    if (card.error) {
      req.flash('danger', `Card with id ${id} not found.`);
      return redirect(req, res, '/404');
    }

    return redirect(req, res, card.image_flip);
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
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

// Redirect old P1P1 URLs to new cube-based URLs
router.get('/p1p1/:packId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', (req, res) => {
  return redirect(req, res, `/cube/p1p1/${req.params.packId}`);
});

// Mount P1P1 archive routes
router.use('/p1p1', require('./dailyP1P1History'));

module.exports = router;
