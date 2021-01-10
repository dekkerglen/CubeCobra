const mongoose = require('mongoose');

const cardSchema = require('./cardSchema');
const deckMigrations = require('./migrations/deckMigrations');
const { withMigrations } = require('./migrations/migrationMiddleware');

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
  deck: [[Number]],
  sideboard: [[Number]],
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

console.warn('deckMigrations', deckMigrations);
module.exports = mongoose.model('Deck', withMigrations(deckSchema, deckMigrations));
