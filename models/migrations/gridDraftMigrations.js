const Cube = require('../cube');
const { addBasics, createPool } = require('../../routes/cube/helper');
const { flatten, mapNonNull } = require('../../serverjs/util');
const { cleanCards } = require('./cleanCards');

const dedupeCardObjects = async (gridDraft) => {
  if (!gridDraft) return null;
  const gridDraftObject = gridDraft.toObject();
  delete gridDraftObject.synergies;

  let cube = await Cube.findById(gridDraft.cube, 'basics').lean();
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

  let cardsArray = flatten(gridDraftObject.initial_state, 2).filter((c) => c);
  if (!Array.isArray(cardsArray) || (cardsArray.length > 0 && (!cardsArray[0] || !cardsArray[0].cardID))) {
    throw new Error(
      `Could not correctly transform the cardsArray. Got ${JSON.stringify(
        cardsArray[0],
        null,
        2,
      )}\n\tfrom ${JSON.stringify(gridDraftObject)}`,
    );
  }
  cardsArray = cleanCards(cardsArray).map((card, index) => ({ ...card, index }));

  const replaceWithIndex = (card) => {
    const idx = cardsArray.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
    if (idx === -1) {
      throw new Error(
        `card ${JSON.stringify(card)} could not be found in the cardsArray.\n${JSON.stringify(cardsArray)}`,
      );
    }
    return idx;
  };
  const mapPack = (pack) => mapNonNull(pack, replaceWithIndex);
  const mapPacks = (packs) => mapNonNull(packs, mapPack);

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

  addBasics(cardsArray, cube.basics, gridDraft);
  gridDraft.cards = cardsArray;
  gridDraft.initial_state = mapPacks(gridDraftObject.initial_state);
  gridDraft.unopenedPacks = mapPacks(gridDraftObject.unopenedPacks);
  gridDraft.seats = mapNonNull(gridDraftObject.seats, (seat) => {
    seat.bot = !!seat.bot;
    seat.drafted = to3d(mapPacks(seat.drafted));
    seat.sideboard = to3d(mapPacks(seat.sideboard));
    seat.pickorder = mapPack(seat.pickorder);
    seat.pickedIndices = [];
    return seat;
  });
  return gridDraft;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
