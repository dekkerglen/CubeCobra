const express = require('express');
const quickselect = require('quickselect');

const carddb = require('../serverjs/cards');
const cardutil = require('../dist/utils/Card.js');
const { addPrices, GetPrices } = require('../serverjs/prices');
const Filter = require('../dist/utils/Filter');
const { getElo } = require('../serverjs/cubefn.js');

const CardRating = require('../models/cardrating');
const Card = require('../models/card');
const Cube = require('../models/cube');

const router = express.Router();

/* Minimum number of picks to show up in Top Cards list. */
const MIN_PICKS = 100;
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
  }
  return cards;
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

async function topCards(filter) {
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

  const ratingsQ = CardRating.find({
    name: {
      $in: names,
    },
  });
  const cardDataQ = Card.find(
    {
      cardName: {
        $in: names.map((name) => name.toLowerCase()),
      },
    },
    'cardName cubes',
  );

  const [ratings, cardData] = await Promise.all([ratingsQ, cardDataQ]);

  const ratingDict = new Map(ratings.map((r) => [r.name, r]));
  const cardDataDict = new Map(cardData.map((c) => [c.cardName, c]));
  const fullData = versions.map((v) => {
    const rating = ratingDict.get(v.name);
    const card = cardDataDict.get(v.name.toLowerCase());
    /* This is a Bayesian adjustment to the rating like IMDB does. */
    const adjust = (r) => (r.picks * r.value + MIN_PICKS * 0.5) / (r.picks + MIN_PICKS);
    const qualifies = rating && typeof rating.picks !== 'undefined' && rating.picks > MIN_PICKS;
    return [
      v.name,
      v.image_normal,
      v.image_flip || null,
      qualifies && rating.value ? adjust(rating) : null,
      rating && typeof rating.picks !== 'undefined' ? rating.picks : null,
      qualifies && rating.elo ? rating.elo : null,
      card ? card.cubes.length : null,
    ];
  });
  /* Sort by number of picks for limit. */
  const data = sortLimit(fullData, MAX_RESULTS, (x) => (x[4] === null ? -1 : x[4]));
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
      title: 'Top Cards',
    });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
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

    // otherwise just go to this ID.
    const card = carddb.cardFromId(req.params.id);
    const data = await Card.findOne({ cardName: card.name_lower });
    if (!data) {
      return res.status(404).render('misc/404', {});
    }

    const cubes = await Promise.all(
      shuffle(data.cubes)
        .slice(0, 12)
        .map((id) => Cube.findOne({ _id: id })),
    );

    const pids = carddb.nameToId[card.name_lower].map((id) => carddb.cardFromId(id).tcgplayer_id);
    const prices = await GetPrices(pids);
    card.elo = (await getElo([card.name], true))[card.name];
    return res.render('tool/cardpage', {
      card,
      data,
      prices,
      cubes,
      related: data.cubedWith.map((name) => carddb.getMostReasonable(name[0])),
    });
  } catch (err) {
    console.error(err);
    req.flash('danger', err.message);
    return res.redirect('/404');
  }
});

module.exports = router;
