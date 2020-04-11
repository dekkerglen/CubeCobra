// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const { GetPrices } = require('./serverjs/prices');
const { getElo } = require('./serverjs/cubefn.js');
const carddb = require('./serverjs/cards.js');
const Deck = require('./models/deck');
const Cube = require('./models/cube');
const CardHistory = require('./models/cardHistory');

const batchSize = 100;

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];

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

async function processCard(card) {
  const pid = carddb.cardFromId(card.cardID).tcgplayer_id;
  const prices = await GetPrices([pid]);

  const current = {};
  current.elo = (await getElo([card.name], true))[card.name];
  if (prices[pid]) {
    current.price = prices[pid];
  }
  if (prices[`${pid}_foil`]) {
    current.price_foil = prices[`${pid}_foil`];
  }

  current.total = cardUses[card.cardName]
    ? [cardUses[card.cardName], cardUses[card.cardName] / cubeCounts.total]
    : [0, 0];
  current.size180 = cardSizeUses.size180[card.cardName]
    ? [cardSizeUses.size180[card.cardName], cardSizeUses.size180[card.cardName] / cubeCounts.size180]
    : [0, 0];
  current.size360 = cardSizeUses.size360[card.cardName]
    ? [cardSizeUses.size360[card.cardName], cardSizeUses.size360[card.cardName] / cubeCounts.size360]
    : [0, 0];
  current.size450 = cardSizeUses.size450[card.cardName]
    ? [cardSizeUses.size450[card.cardName], cardSizeUses.size450[card.cardName] / cubeCounts.size450]
    : [0, 0];
  current.size540 = cardSizeUses.size540[card.cardName]
    ? [cardSizeUses.size540[card.cardName], cardSizeUses.size540[card.cardName] / cubeCounts.size540]
    : [0, 0];
  current.size720 = cardSizeUses.size720[card.cardName]
    ? [cardSizeUses.size720[card.cardName], cardSizeUses.size720[card.cardName] / cubeCounts.size720]
    : [0, 0];
  current.vintage = cardSizeUses.vintage[card.cardName]
    ? [cardSizeUses.vintage[card.cardName], cardSizeUses.vintage[card.cardName] / cubeCounts.vintage]
    : [0, 0];
  current.legacy = cardSizeUses.legacy[card.cardName]
    ? [cardSizeUses.legacy[card.cardName], cardSizeUses.legacy[card.cardName] / cubeCounts.legacy]
    : [0, 0];
  current.modern = cardSizeUses.modern[card.cardName]
    ? [cardSizeUses.modern[card.cardName], cardSizeUses.modern[card.cardName] / cubeCounts.modern]
    : [0, 0];
  current.standard = cardSizeUses.standard[card.cardName]
    ? [cardSizeUses.standard[card.cardName], cardSizeUses.standard[card.cardName] / cubeCounts.standard]
    : [0, 0];
  current.pauper = cardSizeUses.pauper[card.cardName]
    ? [cardSizeUses.pauper[card.cardName], cardSizeUses.pauper[card.cardName] / cubeCounts.pauper]
    : [0, 0];

  card.current = current;
  const d = new Date();
  card.history.push({
    date: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
    data: current,
  });

  const cubes = cubesWithCard[correlationIndex[card.cardName]] ? cubesWithCard[correlationIndex[card.cardName]] : [];
  card.cubes = cubes;
  card.cubesLength = cubes.length;

  // cubed with
  // create correl dict
  const totalCards = carddb.cardnames.length;
  const items = [];
  for (let i = 0; i < totalCards; i += 1) {
    items.push([
      carddb.cardnames[i].toLowerCase(),
      correlations[correlationIndex[card.cardName]][correlationIndex[carddb.cardnames[i].toLowerCase()]],
    ]);
  }

  // Sort the array based on the second element

  // quickselect(items, 100, 0, items.length - 1, function(first, second) {
  //    return second[1] - first[1];
  // });

  // quickselect isn't sorting correctly for some reason
  items.sort((first, second) => {
    return second[1] - first[1];
  });

  // Create a new array with only the first 100 items
  card.cubedWith = items.slice(0, 100);
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
    for (let i = 0; i < totalCards; i += batchSize) {
      const cardnames = carddb.cardnames.slice(i, i + batchSize);
      const cardids = cardnames.map((cardname) => carddb.nameToId[cardname.toLowerCase()]).flat();
      const cardqs = cardids.map((cardID) =>
        CardHistory.findOne({ cardID })
          .lean()
          .exec(),
      );

      const batch = await Promise.all(cardqs);

      for (let j = 0; j < batch.length; j += 1) {
        if (!batch[j]) {
          batch[j] = new CardHistory();
          batch[j].cardName = carddb.cardFromId(cardids[j]).name_lower;
          batch[j].cardID = cardids[j];
        }
        // await processCard(batch[j]);
      }

      await Promise.all(batch.map((obj) => processCard(obj)));

      const saveq = batch.map((item) => {
        return CardHistory.findOneAndUpdate({ _id: item._id }, item, { upsert: true });
      });

      await Promise.all(saveq);
      console.log(`Finished: ${i + batchSize} of ${totalCards} cards.`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
