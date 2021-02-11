// Load Environment Variables
require('dotenv').config();

const express = require('express');

const carddb = require('../serverjs/cards');
const cardutil = require('../dist/utils/Card.js');
const getBlankCardHistory = require('../src/utils/BlankCardHistory.js');
const { filterUses, makeFilter, filterCardsDetails } = require('../dist/filtering/FilterCards');
const generateMeta = require('../serverjs/meta.js');
const util = require('../serverjs/util.js');
const { render } = require('../serverjs/render');

const CardHistory = require('../models/cardHistory');
const Cube = require('../models/cube');
const Deck = require('../models/deck');

const router = express.Router();

/* Minimum number of picks for data to show up in Top Cards list. */
const MIN_PICKS = 100;
/* Page size for results */
const PAGE_SIZE = 96;

async function matchingCards(filter) {
  let cards = carddb.allCards().filter((card) => !card.digital && !card.isToken);
  // In the first pass, cards don't have rating or picks, and so match all those filters.
  // In the second pass, we add that information.
  if (filterUses(filter, 'rating') || filterUses(filter, 'picks') || filterUses(filter, 'cubes')) {
    const oracleIds = cards.map(({ oracle_id }) => oracle_id); // eslint-disable-line camelcase
    const historyObjects = await CardHistory.find(
      { oracleId: { $in: oracleIds } },
      'oracleId current.rating current.picks current.cubes',
    ).lean();
    const historyDict = new Map(historyObjects.map((h) => [h.oracleId, h]));
    cards = cards.map((card) => {
      const history = historyDict.get(card.oracle_id);
      return {
        ...card,
        rating: history ? history.current.rating : null,
        picks: history ? history.current.picks : null,
        cubes: history ? history.current.cubes : null,
      };
    });
  }
  return filterCardsDetails(cards, filter);
}

async function topCards(filter, sortField = 'elo', page = 0, direction = 'descending', minPicks = MIN_PICKS) {
  let cards = await matchingCards(filter);

  const keys = new Set();
  const filtered = [];
  for (const card of cards) {
    if (!keys.has(card.name_lower)) {
      filtered.push(carddb.getMostReasonableById(card._id));
      keys.add(card.name_lower);
    }
  }
  cards = filtered;

  const oracleIdMap = new Map();
  for (const card of cards) {
    if (oracleIdMap.has(card.oracle_id)) {
      oracleIdMap.get(card.oracle_id).push(card);
    } else {
      oracleIdMap.set(card.oracle_id, [card]);
    }
  }

  const oracleIds = [...oracleIdMap.keys()];
  const query = filter
    ? { oracleId: { $in: oracleIds }, 'current.picks': { $gte: minPicks } }
    : { 'current.picks': { $gte: minPicks } };
  const selectedVersions = new Map(
    [...oracleIdMap.entries()].map(([oracleId, versions]) => [
      oracleId,
      carddb.getFirstReasonable(versions.map(({ _id }) => _id)),
    ]),
  );

  const sortName = `current.${sortField}`;
  const sort = {};
  sort[sortName] = direction === 'ascending' ? 1 : -1;

  const dataQ = await CardHistory.find(query)
    .sort(sort)
    .skip(PAGE_SIZE * page)
    .limit(PAGE_SIZE)
    .lean();
  const numResultsQ = CardHistory.countDocuments(query);

  const [data, numResults] = await Promise.all([dataQ, numResultsQ]);

  return {
    numResults,
    data: data
      .filter(({ oracleId }) => selectedVersions.has(oracleId))
      .map(({ oracleId, current }) => {
        const { elo, picks, cubes } = current;
        const version = selectedVersions.get(oracleId);
        return [
          version.name,
          version.image_normal,
          version.image_flip || null,
          Number.isFinite(picks) ? picks : 0,
          Number.isFinite(elo) ? elo : null,
          Number.isFinite(cubes) ? cubes : 0,
        ];
      }),
  };
}

// sorts: ['elo', 'date', 'price', 'alphabetical']
// direction: ['ascending', 'descending']
// distinct: ['names', 'printings']

const sortFunctions = {
  elo: (direction) => (a, b) => {
    const factor = direction === 'ascending' ? 1 : -1;
    if (a.elo > b.elo) {
      return factor;
    }
    if (a.elo < b.elo) {
      return -factor;
    }
    return 0;
  },
  date: (direction) => (a, b) => {
    const factor = direction === 'ascending' ? 1 : -1;
    if (a.released_at > b.released_at) {
      return factor;
    }
    if (a.released_at < b.released_at) {
      return -factor;
    }
    return 0;
  },
  price: (direction) => (a, b) => {
    const factor = direction === 'ascending' ? 1 : -1;
    if ((a.prices.usd || a.prices.usd_foil) > (b.prices.usd || b.prices.usd_foil)) {
      return factor;
    }
    if ((a.prices.usd || a.prices.usd_foil) < (b.prices.usd || b.prices.usd_foil)) {
      return -factor;
    }
    return 0;
  },
  alphabetical: (direction) => (a, b) => {
    const factor = direction === 'descending' ? 1 : -1;
    return a.name.localeCompare(b.name) * factor;
  },
};

async function searchCards(filter, sort = 'elo', page = 0, direction = 'descending', distinct = 'names') {
  let cards = await matchingCards(filter);

  if (distinct === 'names') {
    const keys = new Set();
    const filtered = [];
    for (const card of cards) {
      if (!keys.has(card.name_lower)) {
        filtered.push(carddb.getMostReasonableById(card._id));
        keys.add(card.name_lower);
      }
    }
    cards = filtered;
  }

  cards = cards.sort(sortFunctions[sort](direction));

  page = parseInt(page, 10);

  return {
    numResults: cards.length,
    data: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
  };
}

router.get('/api/topcards', async (req, res) => {
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
    const results = await topCards(filter, req.query.s, req.query.p, req.query.d);
    res.status(200).send({
      success: 'true',
      ...results,
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
    const results = await searchCards(filter, req.query.s, req.query.p, req.query.d, req.query.di);
    res.status(200).send({
      success: 'true',
      ...results,
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
    const { filter } = makeFilter(req.query.f);
    const { data, numResults } = await topCards(filter, req.query.s, req.query.p, req.query.d);

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
        versions: data.versions.map((cardid) => carddb.cardFromId(cardid)),
        related,
        cubes: req.user ? await Cube.find({ owner: req.user._id }, 'name _id') : [],
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

const cubePageSize = 100;

router.get('/api/downloadcubes/:page/:key', async (req, res) => {
  try {
    if (req.params.key !== process.env.DOWNLOAD_API_KEY) {
      return res.status(401).send({
        success: 'false',
      });
    }

    const count = await Cube.estimatedDocumentCount();
    if (req.params.page * cubePageSize > count) {
      return res.status(400).send({
        message: 'Page exceeds collection size',
        success: 'false',
      });
    }

    let cubeQ;
    if (req.query.prevMax) {
      cubeQ = Deck.find({ shortID: { $gt: req.query.prevMax } }, 'cards shortID')
        .sort({ shortID: 1 })
        .limit(cubePageSize)
        .lean();
    } else {
      cubeQ = Deck.find({}, 'cards shortID')
        .sort({ shortID: 1 })
        .skip(req.params.page * cubePageSize)
        .limit(cubePageSize)
        .lean();
    }
    const cubes = await cubeQ;

    const prevMax = cubes[cubes.length - 1].shortID;
    return res.status(200).send({
      success: 'true',
      prevMax,
      pages: Math.ceil(count / cubePageSize),
      cubes: cubes.map((cube) => cube.cards.map((card) => carddb.cardFromId(card.cardID).name_lower)),
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message,
      success: 'false',
    });
  }
});

const deckPageSize = 1000;

router.get('/api/downloaddecks/:page/:key', async (req, res) => {
  try {
    if (req.params.key !== process.env.DOWNLOAD_API_KEY) {
      return res.status(401).send({
        success: 'false',
      });
    }

    const count = await Deck.estimatedDocumentCount();
    if (req.params.page * deckPageSize > count) {
      return res.status(400).send({
        message: 'Page exceeds collection size',
        success: 'false',
      });
    }

    let deckQ;
    if (req.query.prevMax) {
      deckQ = Deck.find({ date: { $gt: req.query.prevMax } }, 'seats date')
        .sort({ date: 1 })
        .limit(deckPageSize)
        .lean();
    } else {
      deckQ = Deck.find({}, 'seats date')
        .sort({ date: 1 })
        .skip(req.params.page * deckPageSize)
        .limit(deckPageSize)
        .lean();
    }
    const decks = await deckQ;

    const prevMax = decks[decks.length - 1].date;

    return res.status(200).send({
      success: 'true',
      prevMax,
      pages: Math.ceil(count / deckPageSize),
      decks: decks.map((deck) => {
        const main = [];
        const side = [];

        if (deck.seats[0] && deck.seats[0].deck) {
          for (const col of deck.seats[0].deck) {
            for (const card of col) {
              if (card && card.cardID) {
                main.push(carddb.cardFromId(card.cardID).name_lower);
              }
            }
          }
        }

        if (deck.seats[0] && deck.seats[0].sideboard) {
          for (const col of deck.seats[0].sideboard) {
            for (const card of col) {
              side.push(carddb.cardFromId(card.cardID).name_lower);
            }
          }
        }

        return { main, side };
      }),
    });
  } catch (err) {
    return res.status(500).send({
      message: err.message,
      success: 'false',
    });
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

module.exports = router;
