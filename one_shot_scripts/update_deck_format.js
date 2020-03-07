const mongoose = require('mongoose');
const Deck = require('../models/deck');
const Draft = require('../models/draft');
const mongosecrets = require('../../cubecobrasecrets/mongodb');
var carddb = require('../serverjs/cards.js');
var cubefn = require('../serverjs/cubefn.js');

const batch_size = 100;

function arrayIsSubset(needles, haystack) {
  return needles.every((x) => haystack.includes(x));
}

function botRating(botColors, card, rating) {
  const colors = card.colors || card.details.color_identity;
  const subset = arrayIsSubset(colors, botColors) && colors.length > 0;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = fetchLands.includes(card.details.name);

  if (isLand) {
    if (subset) {
      //if fetches don't have the color identity override, they get lumped into this category
      rating *= 1.4;
    } else if (overlap || isFetch) {
      rating *= 1.2;
    } else {
      rating *= 1.1;
    }
  } else if (subset) {
    rating *= 1.3;
  } else if (overlap) {
    rating *= 1.1;
  }

  return rating;
}

async function buildDeck(cards, bot) {
  //cards will be a list of cardids

  cards = cards.map((id) => {
    if (Array.isArray(id)) {
      if (id.length <= 0) {
        const details = carddb.getPlaceholderCard('');
        return {
          tags: [],
          colors: details.colors,
          cardID: details._id,
          cmc: details.cmc,
          type_line: details.type,
          details: details,
        };
      }
      if (id[0].cardID) {
        id = id[0].cardID;
      } else {
        id = id[0];
      }
    } else if (id.cardID) {
      id = id.cardID;
    }
    const details = carddb.cardFromId(id);
    return {
      tags: [],
      colors: details.colors,
      cardID: details._id,
      cmc: details.cmc,
      type_line: details.type,
      details: details,
    };
  });

  const elos = await cubefn.getElo(cards.map((card) => card.details.name));
  const nonlands = cards.filter((card) => !card.type_line.toLowerCase().includes('land'));
  const lands = cards.filter((card) => card.type_line.toLowerCase().includes('land'));

  sort_fn = function(a, b) {
    if (bot) {
      return botRating(b, bot, elos[b.details.name]) - botRating(a, bot, elos[a.details.name]);
    } else {
      return elos[b.details.name] - elos[a.details.name];
    }
  };

  nonlands.sort(sort_fn);
  lands.sort(sort_fn);

  const main = nonlands.slice(0, 23).concat(lands.slice(0, 17));
  const side = nonlands.slice(23).concat(lands.slice(17));

  const deck = [];
  const sideboard = [];
  for (let i = 0; i < 16; i += 1) {
    deck.push([]);
    if (i < 8) {
      sideboard.push([]);
    }
  }

  for (const card of main) {
    let index = Math.min(card.cmc, 7);
    if (!card.type_line.toLowerCase().includes('creature')) {
      index += 8;
    }
    deck[index].push(card);
  }
  for (const card of side) {
    sideboard[Math.min(card.cmc, 7)].push(card);
  }
  return {
    deck,
    sideboard,
  };
}

async function update(deck) {
  const draft = deck.draft ? await Draft.findById(deck.draft) : null;

  if (
    deck.newformat == false &&
    deck.cards[deck.cards.length - 1] &&
    typeof deck.cards[deck.cards.length - 1][0] === 'object'
  ) {
    //old format
    deck.seats = [];

    const playerdeck = await buildDeck(deck.cards[0]);

    const playerSeat = {
      bot: null,
      userid: deck.owner,
      username: deck.username,
      pickorder: deck.cards[0],
      name: deck.name,
      description: deck.description,
      cols: 16,
      deck: playerdeck.deck,
      sideboard: playerdeck.sideboard,
    };

    deck.seats.push(playerSeat);

    //add bots
    for (let i = 1; i < deck.cards.length; i += 1) {
      //need to build a deck with this pool...
      const botdeck = await buildDeck(deck.cards[i]);
      const bot = {
        bot: deck.bots[i - 1],
        pickorder: deck.cards[i].map((id) => {
          if (typeof id === 'string' || id instanceof String) {
            const details = carddb.cardFromId(id);
            return {
              tags: [],
              colors: details.colors,
              cardID: details._id,
              cmc: details.cmc,
              type_line: details.type,
            };
          } else {
            return id;
          }
        }),
        name: 'Bot ' + (i + 1) + ': ' + deck.bots[i - 1][0] + ', ' + deck.bots[i - 1][1],
        description:
          'This deck was drafted by a bot with color preference for ' +
          deck.bots[i - 1][0] +
          ' and ' +
          deck.bots[i - 1][1] +
          '.',
        cols: 16,
        deck: botdeck.deck,
        sideboard: botdeck.sideboard,
      };
      deck.seats.push(bot);
    }
  } else {
    //new format
    deck.seats = [];

    const playerSeat = {
      bot: null,
      userid: deck.owner,
      username: deck.username,
      pickorder: draft ? draft.pickorder : [],
      name: deck.name,
      description: deck.description,
      cols: 16,
      deck: deck.playerdeck,
      sideboard: deck.playersideboard,
    };

    deck.seats.push(playerSeat);

    //add bots
    for (let i = 0; i < deck.cards.length; i += 1) {
      //need to build a deck with this pool...
      const botdeck = await buildDeck(deck.cards[i]);
      const bot = {
        bot: deck.bots[i],
        pickorder: deck.cards[i].map((id) => {
          if (typeof id === 'string' || id instanceof String) {
            const details = carddb.cardFromId(id);
            return {
              tags: [],
              colors: details.colors,
              cardID: details._id,
              cmc: details.cmc,
              type_line: details.type,
            };
          } else {
            return id;
          }
        }),
        name: 'Bot ' + i + ': ' + deck.bots[i][0] + ', ' + deck.bots[i][1],
        description:
          'This deck was drafted by a bot with color preference for ' +
          deck.bots[i][0] +
          ' and ' +
          deck.bots[i][1] +
          '.',
        cols: 16,
        deck: botdeck.deck,
        sideboard: botdeck.sideboard,
      };
      deck.seats.push(bot);
    }
  }

  return deck.save();
}

(async () => {
  await carddb.initializeCardDb();

  var i = 0;
  mongoose.connect(mongosecrets.connectionString).then(async (db) => {
    const count = await Deck.countDocuments({"seats.0": { "$exists": true }});
    const cursor = Deck.find({"seats.0": { "$exists": true }})
      .lean()
      .cursor();

    //batch them in 100
    for (var i = 0; i < count; i += batch_size) {
      const decks = [];
      for (var j = 0; j < batch_size; j++) {
        if (i + j < count) {
          let deck = await cursor.next();
          if (deck) {
            decks.push(deck);
          }
        }
      }
      await Promise.all(decks.map((deck) => update(deck)));
      console.log('Finished: ' + Math.min(count, i + batch_size) + ' of ' + count + ' decks');
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
