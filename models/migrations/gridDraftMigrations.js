const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');
const { flatten, mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = (gridDraft) => {
  if (!gridDraft) return null;
  const gridDraftObject = gridDraft.toObject();

  const cardsArray = flatten(gridDraftObject.initial_state, 2).map((card, index) => ({ ...card, index }));
  if (cardsArray.includes(-1) || !cardsArray[0] || !cardsArray[0].cardID) {
    return null;
  }
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

  addBasicsToDeck(gridDraft, cardsArray, carddb, true);
  gridDraft.initial_state = mapPacks(gridDraftObject.initial_state);
  gridDraft.unopenedPacks = mapPacks(gridDraftObject.unopenedPacks);
  gridDraft.seats = mapNonNull(gridDraftObject.seats, (seat) => {
    seat.drafted = mapPacks(seat.drafted);
    seat.sideboard = mapPacks(seat.sideboard);
    seat.pickorder = mapPack(seat.pickorder);
    return seat;
  });
  return gridDraft;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
