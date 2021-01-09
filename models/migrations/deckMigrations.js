const { migration } = require('@baethon/mongoose-lazy-migration');

const carddb = require('../../serverjs/cards');
const { addBasicsToDeck } = require('../../serverjs/cubefn');

const dedupeCardObjects = (deck) => {
  if (!deck) return null;
  if (deck.cards && deck.cards.length > 0) return deck;

  const cards = [];
  for (const seat of deck.seats || []) {
    seat.deck = (seat.deck || []).map((pack) =>
      (pack || []).map((card) => {
        cards.push(card);
        return cards.length - 1;
      }),
    );
    seat.sideboard = (seat.sideboard || []).map((pack) =>
      (pack || []).map((card) => {
        cards.push(card);
        return cards.length - 1;
      }),
    );
    seat.pickorder = (seat.pickorder || []).map((card) => cards.findIndex((card2) => card.cardID === card2.cardID));
  }
  addBasicsToDeck(deck, carddb);
  return deck;
};

const migrations = [migration(1, dedupeCardObjects)];

module.exports = migrations;
