const express = require('express');

const carddb = require('../serverjs/cards');
const { fromEntries } = require('../serverjs/util');
const Filter = require('../dist/util/Filter');

const CardRating = require('../models/cardrating');

const router = express.Router();

function matchingCards(filter) {
  const cards = carddb.allCards();
  if (filter.length > 0) {
    return cards.filter(card => Filter.filterCard({
      details: card
    }, filter, /* inCube */ false));
  } else {
    return cards;
  }
}

function makeFilter(filterText) {
  if (filterText === '') {
    return [];
  }

  const tokens = [];
  const valid = Filter.tokenizeInput(filterText, tokens) && Filter.verifyTokens(tokens);

  return {
    err: !valid,
    filter: [Filter.parseTokens(tokens)],
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
    'name': {
      $in: names,
    },
  }).catch(err => {
    console.error(err);
    res.sendStatus(500);
  }).then(ratings => {
    const ratingDict = new Map(ratings.map(r => [r.name, r.value]));
    return {
      ratings,
      versions,
      names,
      data: versions.map(v => [v.name, v.image_normal, ratingDict.get(v.name) || null]),
    };
  });
}

router.get('/api/topcards', (req, res) => {
  if (!req.query.f) {
    res.sendStatus(400);
    return;
  }

  const { err, filter } = makeFilter(req.query.f);
  if (err) {
    res.sendStatus(400);
    return;
  }

  topCards(filter, res).then(({ data }) => {
    res.status(200).send({ data });
  });
});

router.get('/topcards', (req, res) => {
  const { err, filter } = makeFilter(req.query.f);

  topCards(filter, res).then(({ data }) => {
    res.render('tool/topcards', { data });
  });
});

module.exports = router;