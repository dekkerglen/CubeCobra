const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');

const dedupeCardObjects = (deck) => {
  if (!deck) return null;
  if (deck.cards && deck.cards.length > 0) return deck;

  const cards = [];
  for (const seat of deck.seats || []) {
    seat.deck = (seat.deck || []).map((pack) =>
      (pack || []).map((card) => {
        const index = cards.length;
        cards.push({ ...card, index });
        return index;
      }),
    );
    seat.sideboard = (seat.sideboard || []).map((pack) =>
      (pack || []).map((card) => {
        const index = cards.length;
        cards.push({ ...card, index });
        return index;
      }),
    );
    seat.pickorder = (seat.pickorder || []).map((card) => cards.findIndex((card2) => card.cardID === card2.cardID));
  }
  addBasicsToDeck(deck, cards, carddb);
  return deck;
};

const migrations = [{ version: 1, migration: dedupeCardObjects }];

module.exports = migrations;
