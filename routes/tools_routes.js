const express = require('express');
const quickselect = require('quickselect');

const carddb = require('../serverjs/cards');
const Filter = require('../dist/util/Filter');

const CardRating = require('../models/cardrating');

const router = express.Router();

/* Minimum number of picks to show up in Top Cards list. */
const MIN_PICKS = 20;
/* Maximum results to return on a vague filter string. */
const MAX_RESULTS = 300;

/* Gets k sorted minimum elements of arr. */
/* Modifies arr. */
function sortLimit(arr, k, keyF) {
  keyF = keyF || (x => x);
  const compareF = (x, y) => keyF(x) - keyF(y);
  if (k < arr.length) {
    quickselect(arr, k, 0, arr.length - 1, compareF);
  }
  const result = arr.slice(0, k);
  result.sort(compareF);
  return result;
}

function matchingCards(filter) {
  const cards = carddb.allCards();
  if (filter.length > 0) {
    return cards.filter(card => Filter.filterCard({
      details: card,
    }, filter, /* inCube */ false));
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

function topCards(filter, res) {
  const cards = matchingCards(filter);
  const nameMap = new Map();
  for (const card of cards) {
    if (nameMap.has(card.name)) {
      nameMap.get(card.name).push(card);
    } else {
      nameMap.set(card.name, [card]);
    }
  }
  const names = [...nameMap.keys()];
  const versions = [...nameMap.values()].map(possible => {
    // TODO: pull out and use notPromoOrDigitalId in cube_routes.js
    let nonPromo = possible.find(card => !card.promo && !card.digital && card.border_color != 'gold');
    return nonPromo || possible[0];
  });

  return CardRating.find({
    name: {
      $in: names,
    },
    picks: {
      $gte: MIN_PICKS,
    },
  }).then(ratings => {
    const ratingDict = new Map(ratings.map(r => [r.name, r]));
    const fullData = versions.map(v => {
      const rating = ratingDict.get(v.name);
      /* This is a Bayesian adjustment to the rating like IMDB does. */
      const adjust = r => (r.picks * r.value + MIN_PICKS * 0.5) / (r.picks + MIN_PICKS)
      return [
        v.name,
        v.image_normal,
        v.image_flip || null,
        rating ? adjust(rating) : null,
        rating ? rating.picks : null,
      ];
    });
    const nonNullData = fullData.filter(x => x[3] !== null);
    const data = sortLimit(nonNullData, MAX_RESULTS, x => -(x[3] === null ? -1 : x[3]));
    return {
      ratings,
      versions,
      names,
      data,
    };
  });
}

router.get('/api/topcards', (req, res) => {
  const {
    err,
    filter,
  } = makeFilter(req.query.f);
  if (err) {
    res.status(400).send({
      success: 'false',
    });
    return;
  }

  topCards(filter, res).then(({
    data,
  }) => {
    res.status(200).send({
      success: 'true',
      data,
    });
  }).catch(err => {
    console.error(err);
    res.status(500).send({
      success: 'false',
    });
  });
});

router.get('/topcards', (req, res) => {
  const {
    err,
    filter,
  } = makeFilter(req.query.f);

  if (err) {
    req.flash('Invalid filter.');
  }

  topCards(filter, res).then(({
    data,
  }) => {
    res.render('tool/topcards', {
      data,
    });
  }).catch(err => {
    console.error(err);
    res.sendStatus(500);
  });
});

module.exports = router;
