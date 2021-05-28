const { cleanCards } = require('./cleanCards');
const Cube = require('../cube');
const { addBasics, createPool } = require('../../routes/cube/helper');
const { flatten, mapNonNull, toNonNullArray } = require('../../serverjs/util');

const dedupeCardObjects = async (draft) => {
  if (!draft) return null;
  const draftObject = draft.toObject();

  let cube = await Cube.findById(draft.cube, 'basics').lean();
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

  let cardsArray = flatten(draftObject.initial_state, 3).filter((c) => c);
  if (!Array.isArray(cardsArray) || (cardsArray.length > 0 && (!cardsArray[0] || !cardsArray[0].cardID))) {
    throw new Error(`Could not correctly transform the cardsArray. Got ${JSON.stringify(cardsArray[0], null, 2)}`);
  }
  cardsArray = cleanCards(cardsArray);
  const replaceWithIndex = (card) => {
    const idx = cardsArray.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
    if (idx === -1) {
      throw new Error(`card ${JSON.stringify(card)} could not be found in the cardsArray.`);
    }
    return idx;
  };
  const mapPack = (pack) => {
    if (pack['0'] && (pack.cards || pack.steps)) {
      delete pack.cards;
      delete pack.steps;
    }
    pack = toNonNullArray(pack);
    return { steps: null, cards: pack.map(replaceWithIndex) };
  };
  const mapPacks = (packs) => mapNonNull(packs, mapPack);
  const mapSeats = (seats) => mapNonNull(seats, mapPacks);
  const replaceNd = (arr) => (Array.isArray(arr) || arr['0'] ? mapNonNull(arr, replaceNd) : replaceWithIndex(arr));
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

  draft.initial_state = mapSeats(draftObject.initial_state);
  addBasics(cardsArray, cube.basics, draft);
  draft.cards = cardsArray;
  draft.seats = mapNonNull(draftObject.seats, (seat) => {
    seat.drafted = to3d(replaceNd(seat.drafted));
    seat.sideboard = to3d(replaceNd(seat.sideboard));
    seat.pickorder = replaceNd(seat.pickorder);
    seat.bot = !!seat.bot;
    seat.trashorder = [];
    return seat;
  });
  return draft;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
