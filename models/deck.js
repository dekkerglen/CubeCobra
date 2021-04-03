const mongoose = require('mongoose');

const cardSchema = require('./shared/cardSchema');
const CURRENT_SCHEMA_VERSION = require('./migrations/deckMigrations').slice(-1)[0].version;

// data for each seat, human or bot
const SeatDeck = {
  bot: [String], // null bot value means human player
  userid: String,
  username: String,
  pickorder: [Number],
  name: String,
  description: {
    type: String,
    default: 'No description available.',
  },
  cols: Number,
  deck: [[[Number]]],
  sideboard: [[[Number]]],
};

// Deck schema
const deckSchema = mongoose.Schema({
  cube: String,
  cubeOwner: String,
  owner: String,
  date: Date,
  draft: {
    type: String,
    default: '',
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
  },
  basics: [Number],
});

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
deckSchema.pre('save', () => {
  this.schemaVersion = CURRENT_SCHEMA_VERSION;
});
const Deck = mongoose.model('Deck', deckSchema);
Deck.CURRENT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

module.exports = Deck;
