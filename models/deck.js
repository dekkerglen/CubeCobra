const mongoose = require('mongoose');

const cardSchema = require('./shared/cardSchema');

// data for each seat, human or bot
const SeatDeck = {
  bot: [String], // null bot value means human player
  userid: mongoose.Schema.Types.ObjectId,
  username: String,
  name: String,
  description: {
    type: String,
    default: 'No description available.',
  },
  deck: [[[Number]]], // nesting is rows->columns->index in column
  sideboard: [[[Number]]], // same as deck.
  pickorder: [Number],
};

// Deck schema
const deckSchema = mongoose.Schema(
  {
    cube: mongoose.Schema.Types.ObjectId,
    cubeOwner: mongoose.Schema.Types.ObjectId,
    owner: mongoose.Schema.Types.ObjectId,
    date: Date,
    draft: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    cubename: {
      type: String,
      default: 'Cube',
    },
    seats: {
      type: [SeatDeck],
      default: [],
    },
    cards: [cardSchema],
    schemaVersion: {
      type: Number,
      default() {
        return void 0; // eslint-disable-line
      },
    },
    basics: [Number],
  },
  { timestamps: true },
);

deckSchema.index({
  cubeOwner: 1,
  date: -1,
});

deckSchema.index({
  date: -1,
});

deckSchema.index({
  cube: 1,
  date: -1,
});

deckSchema.index({
  owner: 1,
  date: -1,
});

deckSchema.index({
  schemaVersion: 1,
});

deckSchema.index({
  draft: 1,
});

const Deck = mongoose.model('Deck', deckSchema);
Deck.CURRENT_SCHEMA_VERSION = 1;

module.exports = Deck;
