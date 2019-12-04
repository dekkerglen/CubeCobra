const express = require('express');
const quickselect = require('quickselect');

const carddb = require('../serverjs/cards');
const {GetPrices} = require('../serverjs/prices.js');

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

function matchingCards(filter) {
  const cards = carddb.allCards();
  if (filter.length > 0) {
    return cards.filter((card) =>
      Filter.filterCard(
        {
          details: card,
        },
        filter,
        /* inCube */ false,
      ),
    );
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
  const versions = [...nameMap.values()].map((possible) => {
    // TODO: pull out and use notPromoOrDigitalId in cube_routes.js
    let nonPromo = possible.find((card) => !card.promo && !card.digital && card.border_color != 'gold');
    return nonPromo || possible[0];
  });

  return CardRating.find({
    name: {
      $in: names,
    },
    picks: {
      $gte: MIN_PICKS,
    },
  }).then((ratings) => {
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
  });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function notPromoOrDigitalId(id) {
  let card = carddb.cardFromId(id);
  return !card.promo && !card.digital && card.border_color != 'gold';
}

function getMostReasonable(cardname) {
  const cards = carddb.nameToId[cardname];
  for(let i = 0; i < cards.length; i++) {
    if(notPromoOrDigitalId(cards[i])) {
      return carddb.cardFromId(cards[i]);
    }
  }
  return carddb.cardFromId(cards[0]);
}


router.get('/api/topcards', (req, res) => {
  const { err, filter } = makeFilter(req.query.f);
  if (err) {
    res.status(400).send({
      success: 'false',
    });
    return;
  }

  topCards(filter, res)
    .then(({ data, names }) => {
      res.status(200).send({
        success: 'true',
        numResults: names.length,
        data,
      });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send({
        success: 'false',
      });
    });
});

router.get('/topcards', (req, res) => {
  const { err, filter } = makeFilter(req.query.f);

  if (err) {
    req.flash('Invalid filter.');
  }

  topCards(filter, res)
    .then(({ data, names }) => {
      res.render('tool/topcards', {
        numResults: names.length,
        data,
      });
    })
    .catch((err) => {
      console.error(err);
      res.sendStatus(500);
    });
});

router.get('/card/:id', async (req, res) => {
  try {    
    //if id is a cardname, redirect to the default version for that card
    let ids = carddb.nameToId[req.params.id.toLowerCase()];
    if(ids) {
      return res.redirect('/tool/card/' + getMostReasonable(req.params.id.toLowerCase())._id);
    }
    let card = carddb.cardFromId(req.params.id);
    const data = await Card.findOne({cardName:card.name.toLowerCase()});

    const cubes = await Promise.all(shuffle(data.cubes).slice(0,12).map((id) => Cube.findOne({_id:id})));

    const pids = carddb.nameToId[card.name.toLowerCase()].map((id) => carddb.cardFromId(id).tcgplayer_id);
    GetPrices(pids, async function(prices) {
      res.render('tool/cardpage', {
        card:card,
        data:data,
        prices:prices,
        cubes:cubes,
        related:data.cubedWith.map((id) => getMostReasonable(id[0]))
      });
    });
  } catch(err) {
    console.log(err); 
    req.flash('danger', err.message); 
    res.redirect('/404');
  }
});

module.exports = router;