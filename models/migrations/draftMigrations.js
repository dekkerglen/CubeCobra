const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');
const { flatten, mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = (draft) => {
  if (!draft) return null;
  if (draft.cards && Array.isArray(draft.cards) && draft.cards.length > 0) return draft;

  const defaultPack = { filters: [], trash: 0, sealed: false, picksPerPass: 1 };

  const replaceWithIndex = (card) => draft.cards.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
  const mapPack = (pack) => ({ ...defaultPack, cards: mapNonNull(pack, replaceWithIndex) });
  const mapPacks = (packs) => mapNonNull(packs, mapPack);
  const mapSeats = (seats) => mapNonNull(seats, mapPacks);
  const replace1d = (arr) => mapNonNull(arr, replaceWithIndex);
  const replace2d = (arr) => mapNonNull(arr, replace1d);

  const cardsArray = flatten(draft.initial_state, 3).map((card, index) => ({ ...card, index }));
  addBasicsToDeck(draft, cardsArray, carddb, true);
  draft.initial_state = mapSeats(draft.initial_state);
  draft.unopenedPacks = mapSeats(draft.unopenedPacks);
  draft.seats = mapNonNull(draft.seats, (seat) => {
    seat.drafted = replace2d(seat.drafted);
    seat.sideboard = replace2d(seat.sideboard);
    seat.packbacklog = mapPacks(seat.packbacklog);
    seat.pickorder = replace1d(seat.pickorder);
    return seat;
  });
  return draft;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
