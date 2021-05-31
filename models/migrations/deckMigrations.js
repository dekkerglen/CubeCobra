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

  let cardsArray = [];
  const replaceWithIndexNd = (pile) => {
    if (Array.isArray(pile)) {
      return mapNonNull(pile, replaceWithIndexNd);
    }
    const index = cardsArray.length;
    cardsArray.push({ ...pile, index });
    return index;
  };
  const replaceWithIndex = (card) => {
    const idx = cardsArray.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
    if (idx === -1) {
      if (Number.isFinite(card)) return null;
      throw new Error(
        `card ${JSON.stringify(card)} could not be found in the cardsArray.\n${JSON.stringify(cardsArray)}.`,
      );
    }
    return idx;
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
  cardsArray = cleanCards(cardsArray);

  deck.seats = mapNonNull(deckObject.seats, (seat) => {
    seat.deck = to3d(replaceWithIndexNd(seat.deck));
    seat.sideboard = to3d(replaceWithIndexNd(seat.sideboard));
    seat.pickorder = mapNonNull(seat.pickorder, replaceWithIndex).filter((c) => c !== null);
    return seat;
  });
  addBasics(cardsArray, cube.basics, deck);
  deck.cards = cardsArray;
  return deck;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
