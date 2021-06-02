const { cleanCards } = require('./cleanCards');
const Cube = require('../cube');
const { addBasics, createPool } = require('../../routes/cube/helper');
const { mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = async (deck) => {
  if (!deck) return null;
  const deckObject = deck.toObject();

  let cube = await Cube.findById(deck.cube, 'basics').lean();
  if (!cube || !Array.isArray(cube.basics)) {
    cube = {
      basics: [
        '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
        '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
        '19e71532-3f79-4fec-974f-b0e85c7fe701',
        '8365ab45-6d78-47ad-a6ed-282069b0fabc',
        '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
      ],
    };
  }

  const cardsArray = [];
  const replaceWithIndexNd = (pile) => {
    if (Array.isArray(pile) || !pile.cardID) {
      return mapNonNull(pile, replaceWithIndexNd);
    }
    const existingIndex = cardsArray.findIndex(({ cardID }) => cardID === pile.cardID);
    if (existingIndex === -1) {
      const index = cardsArray.length;
      cardsArray.push({ ...pile, index });
      return index;
    }
    return existingIndex;
  };

  const to3d = (collection) => {
    if (!collection || !Array.isArray(collection) || collection.length === 0) return createPool();
    if (Array.isArray(collection[0])) {
      if (collection[0].length > 0 && Array.isArray(collection[0][0])) return collection;
      if (collection.length > 8) return [collection.slice(0, 8), collection.slice(8)];
      return [collection];
    }
    const pool = createPool();
    pool[0][0] = collection.flatten();
    return pool;
  };

  deck.seats = mapNonNull(deckObject.seats, (seat) => {
    seat.deck = to3d(replaceWithIndexNd(seat.deck));
    seat.sideboard = to3d(replaceWithIndexNd(seat.sideboard));
    delete seat.pickorder;
    return seat;
  });
  addBasics(cardsArray, cube.basics, deck);
  deck.cards = cleanCards(cardsArray, false);
  return deck;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
