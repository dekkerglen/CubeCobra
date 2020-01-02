const express = require('express');
const quickselect = require('quickselect');

const carddb = require('../serverjs/cards');
const cardutil = require('../dist/util/Card.js');
const { addPrices, GetPrices } = require('../serverjs/prices');
const Filter = require('../dist/util/Filter');

const CardRating = require('../models/cardrating');
const Card = require('../models/card');
const Cube = require('../models/cube');

const router = express.Router();

/* Minimum number of picks to show up in Top Cards list. */
const MIN_PICKS = 40;
/* Maximum results to return on a vague filter string. */
const MAX_RESULTS = 1000;

/* Gets k sorted minimum elements of arr. */
/* Modifies arr. */
function sortLimit(arr, k, keyF) {
  keyF = keyF || ((x) => x);
  const compareF = (x, y) => keyF(x) - keyF(y);
  if (k < arr.length) {
    quickselect(arr, k, 0, arr.length - 1, compareF);
  }
  const result = arr.slice(0, k);
  result.sort(compareF);
  return result;
}

async function matchingCards(filter) {
  const cards = carddb.allCards().filter((card) => !card.digital);
  if (filter.length > 0) {
    // In the first pass, cards don't have prices, and so match all price filters.
    // In the seoncd pass, we add prices.
    const firstPass = Filter.filterCardsDetails(cards, filter);
    const withPrices = await addPrices(firstPass);
    return Filter.filterCardsDetails(withPrices, filter);
  } else {
    return cards;
  }
}

function makeFilter(filterText) {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: [],
    };
  }

  const tokens = [];
  const valid = Filter.tokenizeInput(filterText, tokens) && Filter.verifyTokens(tokens);

  return {
    err: !valid,
    filter: valid ? [Filter.parseTokens(tokens)] : [],
  };
}

async function topCards(filter, res) {
  const cards = await matchingCards(filter);
  const nameMap = new Map();
  for (const card of cards) {
    if (nameMap.has(card.name)) {
      nameMap.get(card.name).push(card);
    } else {
      nameMap.set(card.name, [card]);
    }
  }
  const names = [...nameMap.keys()];
  const versions = [...nameMap.values()].map((possible) => {
    const nonPromo = possible.find((card) => carddb.notPromoOrDigitalCard(card));
    return nonPromo || possible[0];
  });

  const ratings = await CardRating.find({
    name: {
      $in: names,
    },
    picks: {
      $gte: MIN_PICKS,
    },
  });

  const ratingDict = new Map(ratings.map((r) => [r.name, r]));
  const fullData = versions.map((v) => {
    const rating = ratingDict.get(v.name);
    /* This is a Bayesian adjustment to the rating like IMDB does. */
    const adjust = (r) => (r.picks * r.value + MIN_PICKS * 0.5) / (r.picks + MIN_PICKS);
    return [
      v.name,
      v.image_normal,
      v.image_flip || null,
      rating ? adjust(rating) : null,
      rating ? rating.picks : null,
      rating && rating.elo ? rating.elo : null,
    ];
  });
  const nonNullData = fullData.filter((x) => x[3] !== null);
  const data = sortLimit(nonNullData, MAX_RESULTS, (x) => (x[3] === null ? -1 : x[3]));
  return {
    ratings,
    versions,
    names,
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
  try {
    const { err, filter } = makeFilter(req.query.f);
    if (err) {
      res.status(400).send({
        success: 'false',
      });
      return;
    }

    const { data, names } = await topCards(filter, res);
    res.status(200).send({
      success: 'true',
      numResults: names.length,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
    });
  }
});

router.get('/topcards', async (req, res) => {
  try {
    const { err, filter } = makeFilter(req.query.f);

    if (err) {
      req.flash('Invalid filter.');
    }

    const { data, names } = await topCards(filter, res);
    res.render('tool/topcards', {
      numResults: names.length,
      data,
    });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

router.get('/card/:id', async (req, res) => {
  try {
    //if id is a cardname, redirect to the default version for that card
    let possibleName = cardutil.decodeName(req.params.id);
    let ids = carddb.getIdsFromName(possibleName);
    if (ids) {
      return res.redirect('/tool/card/' + carddb.getMostReasonable(possibleName)._id);
    }
    let card = carddb.cardFromId(req.params.id);
    const data = await Card.findOne({ cardName: card.name_lower });

    const cubes = await Promise.all(
      shuffle(data.cubes)
        .slice(0, 12)
        .map((id) => Cube.findOne({ _id: id })),
    );

    const pids = carddb.nameToId[card.name_lower].map((id) => carddb.cardFromId(id).tcgplayer_id);
    GetPrices(pids, async function(prices) {
      res.render('tool/cardpage', {
        card: card,
        data: data,
        prices: prices,
        cubes: cubes,
        related: data.cubedWith.map((name) => carddb.getMostReasonable(name[0])),
      });
    });
  } catch (err) {
    console.log(err);
    req.flash('danger', err.message);
    res.redirect('/404');
  }
});

module.exports = router;
