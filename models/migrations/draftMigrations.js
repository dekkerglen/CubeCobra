const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');
const { flatten, mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = (draft) => {
  if (!draft) return null;
  const draftObject = draft.toObject();
  const defaultPack = { trash: 0, sealed: false, picksPerPass: 1 };

  const cardsArray = flatten(draftObject.initial_state, 3).map((card, index) => ({ ...card, index }));
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
  const mapPack = (pack) => ({ ...defaultPack, cards: mapNonNull(pack, replaceWithIndex) });
  const mapPacks = (packs) => mapNonNull(packs, mapPack);
  const mapSeats = (seats) => mapNonNull(seats, mapPacks);
  const replace1d = (arr) => mapNonNull(arr, replaceWithIndex);
  const replace2d = (arr) => mapNonNull(arr, replace1d);

  addBasicsToDeck(draft, cardsArray, carddb, true);
  draft.initial_state = mapSeats(draftObject.initial_state);
  draft.unopenedPacks = mapSeats(draftObject.unopenedPacks);
  draft.seats = mapNonNull(draftObject.seats, (seat) => {
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
