const express = require('express');
const serialize = require('serialize-javascript');

const carddb = require('../serverjs/cards');
const cardutil = require('../dist/utils/Card.js');
const { filterUses, makeFilter, filterCardsDetails } = require('../dist/filtering/FilterCards');
const generateMeta = require('../serverjs/meta.js');
const util = require('../serverjs/util.js');

const CardHistory = require('../models/cardHistory');

const router = express.Router();

/* Minimum number of picks for data to show up in Top Cards list. */
const MIN_PICKS = 100;
/* Page size for results */
const PAGE_SIZE = 100;

async function matchingCards(filter) {
  let cards = carddb.allCards().filter((card) => !card.digital && !card.isToken);
  if (filter) {
    // In the first pass, cards don't have prices/picks/elo, and so match all those filters.
    // In the seoncd pass, we add that information.
    if (
      filterUses(filter, 'rating') ||
      filterUses(filter, 'elo') ||
      filterUses(filter, 'picks') ||
      filterUses(filter, 'cubes') ||
      filterUses(filter, 'price') ||
      filterUses(filter, 'price_foil')
    ) {
      const oracleIds = cards.map(({ oracle_id }) => oracle_id); // eslint-disable-line camelcase
      const historyObjects = await CardHistory.find(
        { oracleId: { $in: oracleIds } },
        'oracleId current.rating current.elo current.picks current.cubes current.prices',
      ).lean();
      const historyDict = new Map(historyObjects.map((h) => [h.oracleId, h]));
      cards = cards.map((card) => {
        const history = historyDict.get(card.oracle_id);
        const priceData = history ? history.current.prices.find(({ version }) => version === card._id) : null;
        return {
          ...card,
          rating: history ? history.current.rating : null,
          elo: history ? history.current.elo : null,
          picks: history ? history.current.picks : null,
          cubes: history ? history.current.cubes : null,
          price: priceData ? priceData.price : null,
          price_foil: priceData ? priceData.price_foil : null,
        };
      });
    }
  }
  return filterCardsDetails(cards, filter);
}

async function topCards(filter, sortField = 'elo', page = 0, direction = 'descending') {
  const cards = await matchingCards(filter);
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
    ? { oracleId: { $in: oracleIds }, 'current.picks': { $gt: MIN_PICKS } }
    : { 'current.picks': { $gt: MIN_PICKS } };
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

router.get('/topcards', async (req, res) => {
  try {
    const { filter } = makeFilter(req.query.f);
    const { data, numResults } = await topCards(filter, req.query.s, req.query.p, req.query.d);
    return res.render('tool/topcards', {
      reactProps: serialize({ data, numResults }),
      title: 'Top Cards',
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/404`);
  }
});

router.get('/card/:id', async (req, res) => {
  const card = carddb.cardFromId(req.params.id);
  console.log(card);
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

    // if id is a scryfall ID, redirect to oracle
    const scryfall = carddb.cardFromId(id);
    if (!scryfall.error) {
      id = scryfall.oracle_id;
    }

    // otherwise just go to this ID.
    const card = carddb.getMostReasonableById(carddb.oracleToId[id][0]);
    const data = await CardHistory.findOne({ oracleId: id });
    if (!data) {
      req.flash(
        'danger',
        `Card with identifier ${req.params.id} not found. Acceptable identifiers are card name (english only), scryfall ID, or oracle ID.`,
      );
      return res.status(404).render('misc/404', {});
    }

    const reactProps = {
      card,
      data,
      related: data.cubedWith.map((obj) => carddb.getMostReasonableById(carddb.oracleToId[obj.other][0])),
    };
    return res.render('tool/cardpage', {
      reactProps: serialize(reactProps),
      title: `${card.name}`,
      metadata: generateMeta(
        `${card.name} - Cube Cobra`,
        `Analytics for ${card.name} on CubeCobra`,
        card.image_normal,
        `https://cubecobra.com/card/${req.params.id}`,
      ),
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404/');
  }
});

module.exports = router;
