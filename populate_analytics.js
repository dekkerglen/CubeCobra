// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

const mongoose = require('mongoose');

const carddb = require('./serverjs/cards.js');
const Deck = require('./models/deck');
const Cube = require('./models/cube');
const Card = require('./models/card');
const mongosecrets = require('../cubecobrasecrets/mongodb');

const batchSize = 100;

const basics = ['mountain', 'forest', 'plains', 'island', 'swamp'];

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
        deckCards.push(
          carddb
            .cardFromId(row.cardID)
            .name.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim(),
        );
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
  card.total = cardUses[card.cardName] ? [cardUses[card.cardName], cardUses[card.cardName] / cubeCounts.total] : [0, 0];
  card.size180 = cardSizeUses.size180[card.cardName]
    ? [cardSizeUses.size180[card.cardName], cardSizeUses.size180[card.cardName] / cubeCounts.size180]
    : [0, 0];
  card.size360 = cardSizeUses.size360[card.cardName]
    ? [cardSizeUses.size360[card.cardName], cardSizeUses.size360[card.cardName] / cubeCounts.size360]
    : [0, 0];
  card.size450 = cardSizeUses.size450[card.cardName]
    ? [cardSizeUses.size450[card.cardName], cardSizeUses.size450[card.cardName] / cubeCounts.size450]
    : [0, 0];
  card.size540 = cardSizeUses.size540[card.cardName]
    ? [cardSizeUses.size540[card.cardName], cardSizeUses.size540[card.cardName] / cubeCounts.size540]
    : [0, 0];
  card.size720 = cardSizeUses.size720[card.cardName]
    ? [cardSizeUses.size720[card.cardName], cardSizeUses.size720[card.cardName] / cubeCounts.size720]
    : [0, 0];
  card.vintage = cardSizeUses.vintage[card.cardName]
    ? [cardSizeUses.vintage[card.cardName], cardSizeUses.vintage[card.cardName] / cubeCounts.vintage]
    : [0, 0];
  card.legacy = cardSizeUses.legacy[card.cardName]
    ? [cardSizeUses.legacy[card.cardName], cardSizeUses.legacy[card.cardName] / cubeCounts.legacy]
    : [0, 0];
  card.modern = cardSizeUses.modern[card.cardName]
    ? [cardSizeUses.modern[card.cardName], cardSizeUses.modern[card.cardName] / cubeCounts.modern]
    : [0, 0];
  card.standard = cardSizeUses.standard[card.cardName]
    ? [cardSizeUses.standard[card.cardName], cardSizeUses.standard[card.cardName] / cubeCounts.standard]
    : [0, 0];
  card.pauper = cardSizeUses.pauper[card.cardName]
    ? [cardSizeUses.pauper[card.cardName], cardSizeUses.pauper[card.cardName] / cubeCounts.pauper]
    : [0, 0];

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

  const i = 0;
  mongoose.connect(mongosecrets.connectionString).then(async (db) => {
    createCorrelations();

    // process all cube objects
    console.log('Started: cubes');
    let count = await Cube.countDocuments();
    let cursor = Cube.find().cursor();
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
    cursor = Deck.find().cursor();
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
      const cardqs = cardnames.map((cardname) => {
        return Card.findOne({ cardName: cardname.toLowerCase() }).exec();
      });

      const batch = await Promise.all(cardqs);

      for (let j = 0; j < batch.length; j += 1) {
        if (!batch[j]) {
          batch[j] = new Card();
          batch[j].cardName = cardnames[j].toLowerCase();
        }
        await processCard(batch[j]);
      }

      const saveq = batch.map((item) => {
        return item.save();
      });

      await Promise.all(saveq);
      console.log(`Finished: ${i + batchSize} of ${totalCards} cards.`);
    }

    mongoose.disconnect();
    console.log('done');
  });
})();
