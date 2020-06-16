const express = require('express');
const serialize = require('serialize-javascript');

const carddb = require('../serverjs/cards');
const cardutil = require('../dist/utils/Card.js');
const { filterUses, makeFilter, filterCardsDetails } = require('../dist/filtering/FilterCards');
const generateMeta = require('../serverjs/meta.js');
const util = require('../serverjs/util.js');

const CardHistory = require('../models/cardHistory');
const Cube = require('../models/cube');

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
    ? { $and: [{ oracleId: { $in: oracleIds } }, { 'current.picks': { $gt: MIN_PICKS } }] }
    : { 'current.picks': { $gt: MIN_PICKS } };
  const selectedVersions = new Map(
    [...oracleIdMap.entries()].map(([oracleId, versions]) => [
      oracleId,
      carddb.getFirstReasonable(versions.map(({ _id }) => _id)),
    ]),
  );

  const dataQ = async () => {
    const sortName = `current.${sortField}`;
    const sort = {};
    sort[sortName] = direction === 'ascending' ? 1 : -1;
    const sorted = await CardHistory.find(query)
      .sort(sort)
      .skip(PAGE_SIZE * page)
      .limit(PAGE_SIZE)
      .lean();

    return sorted
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
      });
  };
  const numResultsQ = CardHistory.countDocuments(query);

  const [data, numResults] = await Promise.all([dataQ(), numResultsQ]);

  return {
    numResults,
    data,
  };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

router.get('/api/topcards', async (req, res) => {
  console.log(`getting top cards with sort: ${req.params.sort}, page: ${req.params.page}`);
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
    return res.render('tool/topcards', {
      reactProps: serialize({}),
      title: 'Top Cards',
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/404`);
  }
});

router.get('/card/:id', async (req, res) => {
  try {
    // if id is a cardname, redirect to the default version for that card
    const possibleName = cardutil.decodeName(req.params.id);
    const ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      return res.redirect(`/tool/card/${carddb.getMostReasonable(possibleName)._id}`);
    }

    // if id is a foreign cardname, redirect to english version
    const english = carddb.getEnglishVersion(req.params.id);
    if (english) {
      return res.redirect(`/tool/card/${english}`);
    }

    // if id is a scryfall ID, redirect to oracle
    const scryfall = carddb.cardFromId(req.params.id);
    if (!scryfall.error) {
      return res.redirect(`/tool/card/${scryfall.oracle_id}`);
    }

    // otherwise just go to this ID.
    const card = carddb.getMostReasonableById(carddb.oracleToId[req.params.id][0]);
    const data = await CardHistory.findOne({ oracleId: req.params.id });
    if (!data) {
      return res.status(404).render('misc/404', {});
    }

    const cubes = await Promise.all(
      shuffle(data.cubes)
        .slice(0, 12)
        .map((id) => Cube.findOne({ _id: id })),
    );

    const reactProps = {
      card,
      data,
      cubes,
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
    req.logger.error(err);
    req.flash('danger', err.message);
    return res.redirect('/404');
  }
});

module.exports = router;
