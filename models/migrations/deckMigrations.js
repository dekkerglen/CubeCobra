const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');
const { mapNonNull } = require('../../serverjs/util');

const dedupeCardObjects = (deck) => {
  if (!deck) return null;
  if (deck.cards && Array.isArray(deck.cards) && deck.cards.length > 0) return deck;

  const cards = [];
  const replaceWithIndex2d = (piles) =>
    mapNonNull(piles, (pile) =>
      mapNonNull(pile, (card) => {
        const index = cards.length;
        cards.push({ ...card, index });
        return index;
      }),
    );
  deck.seats = mapNonNull(deck.seats, (seat) => {
    seat.deck = replaceWithIndex2d(seat.deck);
    seat.sideboard = replaceWithIndex2d(seat.sideboard);
    seat.pickorder = mapNonNull(seat.pickorder, (card) => cards.findIndex((card2) => card.cardID === card2.cardID));
    return seat;
  });
  addBasicsToDeck(deck, cards, carddb);
  return deck;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
