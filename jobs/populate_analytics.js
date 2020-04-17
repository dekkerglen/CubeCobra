// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const { GetPrices } = require('../serverjs/prices');
const { getElo } = require('../serverjs/cubefn.js');
const carddb = require('../serverjs/cards.js');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const CardHistory = require('../models/cardHistory');

const batchSize = 100;

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];

const d = new Date();
const currentDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// define .flat()
Object.defineProperty(Array.prototype, 'flat', {
  value(depth = 1) {
    return this.reduce(function(flat, toFlatten) {
      return flat.concat(Array.isArray(toFlatten) && depth > 1 ? toFlatten.flat(depth - 1) : toFlatten);
    }, []);
  },
});

const cardUses = {};
const cardSizeUses = {
  size180: {},
  size360: {},
  size450: {},
  size540: {},
  size720: {},
  pauper: {},
  legacy: {},
  modern: {},
  standard: {},
  vintage: {},
};

// global cube stats
const cubeCounts = {
  total: 0,
  size180: 0,
  size360: 0,
  size450: 0,
  size540: 0,
  size720: 0,
  pauper: 0,
  legacy: 0,
  modern: 0,
  standard: 0,
  vintage: 0,
};

const correlationIndex = {};
const correlations = [];

// use correlationIndex for index
const cubesWithCard = [];

function createCorrelations() {
  const totalCards = carddb.cardnames.length;
  for (let i = 0; i < totalCards; i += 1) {
    correlationIndex[carddb.cardnames[i].toLowerCase()] = i;
    correlations.push([]);
    cubesWithCard.push([]);
    for (let j = 0; j < totalCards; j += 1) {
      correlations[i].push(0);
    }
    if ((i + 1) % 100 === 0) {
      console.log(`Finished: ${i + 1} of ${totalCards} correlations.`);
    }
  }
  console.log('Finish init of correlation matrix.');
}

function attemptIncrement(obj, propname) {
  if (!obj[propname]) {
    obj[propname] = 0;
  }
  obj[propname] += 1;
}

async function processDeck(deck) {
  if (deck.seats && deck.seats[0] && deck.seats[0].deck && deck.seats[0].deck.length > 0) {
    // flatten array
    const deckCards = [];
    deck.seats[0].deck.forEach((col) => {
      col.forEach((row) => {
        if (row && row.cardID) {
          deckCards.push(
            carddb
              .cardFromId(row.cardID)
              .name.toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim(),
          );
        }
      });
    });

    for (let i = 0; i < deckCards.length; i += 1) {
      // could be an invalid card
      if (correlationIndex[deckCards[i]] && !basics.includes(deckCards[i])) {
        for (let j = i + 1; j < deckCards.length; j += 1) {
          if (!basics.includes(deckCards[j])) {
            try {
              correlations[correlationIndex[deckCards[j]]][correlationIndex[deckCards[i]]] += 1;
              correlations[correlationIndex[deckCards[j]]][correlationIndex[deckCards[i]]] += 1;
            } catch (err) {
              console.log(`${deckCards[i]} or ${deckCards[j]} cannot be indexed.`);
            }
          }
        }
      }
    }
  }
}

async function processCube(cube) {
  let cubeSizeDict = cardSizeUses.size180;
  let cubeLegalityDict = cardSizeUses.vintage;

  cubeCounts.total += 1;
  if (cube.card_count <= 180) {
    cubeSizeDict = cardSizeUses.size180;
    cubeCounts.size180 += 1;
  } else if (cube.card_count <= 360) {
    cubeSizeDict = cardSizeUses.size360;
    cubeCounts.size360 += 1;
  } else if (cube.card_count <= 450) {
    cubeSizeDict = cardSizeUses.size450;
    cubeCounts.size450 += 1;
  } else if (cube.card_count <= 540) {
    cubeSizeDict = cardSizeUses.size540;
    cubeCounts.size540 += 1;
  } else {
    cubeSizeDict = cardSizeUses.size720;
    cubeCounts.size720 += 1;
  }

  const isPauper = false;
  if (cube.type) {
    if (cube.type.toLowerCase().includes('standard')) {
      cubeLegalityDict = cardSizeUses.standard;
      cubeCounts.standard += 1;
    } else if (cube.type.toLowerCase().includes('modern')) {
      cubeLegalityDict = cardSizeUses.modern;
      cubeCounts.modern += 1;
    } else if (cube.type.toLowerCase().includes('legacy')) {
      cubeLegalityDict = cardSizeUses.legacy;
      cubeCounts.legacy += 1;
    } else if (cube.type.toLowerCase().includes('vintage')) {
      cubeLegalityDict = cardSizeUses.vintage;
      cubeCounts.vintage += 1;
    }

    if (cube.type.toLowerCase().includes('pauper')) {
      cubeLegalityDict = cardSizeUses.pauper;
      cubeCounts.pauper += 1;
    }
  }

  // cardnames = [];
  cube.cards.forEach((card) => {
    const cardobj = carddb.cardFromId(card.cardID);
    const cardname = cardobj.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (correlationIndex[cardname]) {
      cubesWithCard[correlationIndex[cardname]].push(cube._id);
    }

    // total
    attemptIncrement(cardUses, cardobj.name.toLowerCase());

    // cube sizes
    attemptIncrement(cubeSizeDict, cardobj.name.toLowerCase());

    // cube type
    attemptIncrement(cubeLegalityDict, cardobj.name.toLowerCase());
    if (isPauper) {
      attemptIncrement(cardSizeUses.pauper, cardobj.name.toLowerCase());
    }
  });
}

async function processCard(cardname) {
  const ids = carddb.nameToId[cardname];

  const pids = ids.map((id) => carddb.cardFromId(id).tcgplayer_id);
  const prices = await GetPrices(pids);

  const current = {};
  current.elo = (await getElo([cardname], true))[cardname];

  current.total = cardUses[cardname] ? [cardUses[cardname], cardUses[cardname] / cubeCounts.total] : [0, 0];
  current.size180 = cardSizeUses.size180[cardname]
    ? [cardSizeUses.size180[cardname], cardSizeUses.size180[cardname] / cubeCounts.size180]
    : [0, 0];
  current.size360 = cardSizeUses.size360[cardname]
    ? [cardSizeUses.size360[cardname], cardSizeUses.size360[cardname] / cubeCounts.size360]
    : [0, 0];
  current.size450 = cardSizeUses.size450[cardname]
    ? [cardSizeUses.size450[cardname], cardSizeUses.size450[cardname] / cubeCounts.size450]
    : [0, 0];
  current.size540 = cardSizeUses.size540[cardname]
    ? [cardSizeUses.size540[cardname], cardSizeUses.size540[cardname] / cubeCounts.size540]
    : [0, 0];
  current.size720 = cardSizeUses.size720[cardname]
    ? [cardSizeUses.size720[cardname], cardSizeUses.size720[cardname] / cubeCounts.size720]
    : [0, 0];
  current.vintage = cardSizeUses.vintage[cardname]
    ? [cardSizeUses.vintage[cardname], cardSizeUses.vintage[cardname] / cubeCounts.vintage]
    : [0, 0];
  current.legacy = cardSizeUses.legacy[cardname]
    ? [cardSizeUses.legacy[cardname], cardSizeUses.legacy[cardname] / cubeCounts.legacy]
    : [0, 0];
  current.modern = cardSizeUses.modern[cardname]
    ? [cardSizeUses.modern[cardname], cardSizeUses.modern[cardname] / cubeCounts.modern]
    : [0, 0];
  current.standard = cardSizeUses.standard[cardname]
    ? [cardSizeUses.standard[cardname], cardSizeUses.standard[cardname] / cubeCounts.standard]
    : [0, 0];
  current.pauper = cardSizeUses.pauper[cardname]
    ? [cardSizeUses.pauper[cardname], cardSizeUses.pauper[cardname] / cubeCounts.pauper]
    : [0, 0];

  const cubes = cubesWithCard[correlationIndex[cardname]] ? cubesWithCard[correlationIndex[cardname]] : [];

  // cubed with
  // create correl dict
  const totalCards = carddb.cardnames.length;
  let cubedWith = [];
  for (let i = 0; i < totalCards; i += 1) {
    cubedWith.push([
      carddb.cardnames[i].toLowerCase(),
      correlations[correlationIndex[cardname]][correlationIndex[carddb.cardnames[i].toLowerCase()]],
    ]);
  }

  // quickselect isn't sorting correctly for some reason
  cubedWith.sort((first, second) => {
    return second[1] - first[1];
  });

  cubedWith = cubedWith.slice(0, 100);

  await Promise.all(
    ids.map(async (id) => {
      let card = await CardHistory.findOne({ cardID: id });
      try {
        if (!card) {
          card = new CardHistory();
          card.cardName = carddb.cardFromId(id).name_lower;
          card.cardID = id;
        }
        const pid = carddb.cardFromId(id).tcgplayer_id;

        // set universals
        const cur = { ...current };

        if (prices[pid]) {
          cur.price = prices[pid];
        }
        if (prices[`${pid}_foil`]) {
          cur.price_foil = prices[`${pid}_foil`];
        }

        card.current = cur;
        card.cubedWith = cubedWith;
        card.cubes = cubes;
        card.cubesLength = cubes.length;

        if (!card.history) {
          card.history = [];
        }

        card.history.push({
          date: currentDate,
          data: cur,
        });

        await card.save();
      } catch (error) {
        console.error(error);
        console.log(card);
      }
    }),
  );
}

(async () => {
  await carddb.initializeCardDb();
  mongoose.connect(process.env.MONGODB_URL).then(async (db) => {
    createCorrelations();

    // process all cube objects
    console.log('Started: cubes');
    let count = await Cube.countDocuments();
    let cursor = Cube.find()
      .lean()
      .cursor();
    for (let i = 0; i < count; i += 1) {
      await processCube(await cursor.next());
      if ((i + 1) % 10 === 0) {
        console.log(`Finished: ${i + 1} of ${count} cubes.`);
      }
    }
    console.log('Finished: all cubes');

    // process all deck objects
    console.log('Started: decks');
    count = await Deck.countDocuments();
    cursor = Deck.find()
      .lean()
      .cursor();
    for (let i = 0; i < count; i += 1) {
      await processDeck(await cursor.next());
      if ((i + 1) % 1000 === 0) {
        console.log(`Finished: ${i + 1} of ${count} decks.`);
      }
    }
    console.log('Finished: all decks');

    // save card models
    const totalCards = carddb.cardnames.length;
    for (let i = 0; i < totalCards; i += 1) {
      await processCard(carddb.cardnames.slice(i, i + 1)[0].toLowerCase());
      console.log(`Finished: ${i + 1} of ${totalCards} cards.`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
