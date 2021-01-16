const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');
const { mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = (deck) => {
  if (!deck) return null;
  const deckObject = deck.toObject();

  const cardsArray = [];
  const replaceWithIndex2d = (piles) =>
    mapNonNull(piles, (pile) =>
      mapNonNull(pile, (card) => {
        const index = cardsArray.length;
        cardsArray.push({ ...card, index });
        return index;
      }),
    );
  const replaceWithIndex = (card) => {
    const idx = cardsArray.findIndex((card2) => card && card2 && card.cardID === card2.cardID);
    if (idx === -1) {
      throw new Error(
        `card ${JSON.stringify(card)} could not be found in the cardsArray.\n${JSON.stringify(cardsArray)}`,
      );
    }
    return idx;
  };
  deck.seats = mapNonNull(deckObject.seats, (seat) => {
    seat.deck = replaceWithIndex2d(seat.deck);
    seat.sideboard = replaceWithIndex2d(seat.sideboard);
    seat.pickorder = mapNonNull(seat.pickorder, replaceWithIndex);
    return seat;
  });
  addBasicsToDeck(deck, cardsArray, carddb);
  return deck;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
