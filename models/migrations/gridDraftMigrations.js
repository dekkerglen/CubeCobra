const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');
const { flatten, mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = (gridDraft) => {
  if (!gridDraft) return null;
  if (gridDraft.cards && Array.isArray(gridDraft.cards) && gridDraft.cards.length > 0) return gridDraft;

  const replaceWithIndex = (card) =>
    gridDraft.cards.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
  const mapPack = (pack) => mapNonNull(pack, replaceWithIndex);
  const mapPacks = (packs) => mapNonNull(packs, mapPack);

  const cardsArray = flatten(gridDraft.initial_state, 2).map((card, index) => ({ ...card, index }));
  addBasicsToDeck(gridDraft, cardsArray, carddb, true);
  gridDraft.initial_state = mapPacks(gridDraft.initial_state);
  gridDraft.unopenedPacks = mapPacks(gridDraft.unopenedPacks);
  gridDraft.seats = mapNonNull(gridDraft.seats, (seat) => {
    seat.drafted = mapPacks(seat.drafted);
    seat.sideboard = mapPacks(seat.sideboard);
    seat.pickorder = mapPack(seat.pickorder);
    return seat;
  });
  return gridDraft;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
