const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

// data for each seat, human or bot
const Seat = {
  bot: [String], // null bot value means human player
  name: String,
  userid: String,
  drafted: [[Number]], // organized draft picks
  sideboard: [[Number]], // organized draft picks
  pickorder: [Number],
  packbacklog: [[Number]],
};

// Cube schema
const draftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[[Number]]],
  seats: [Seat],
  synergies: [[Number]],
  basics: {
    Plains: cardSchema,
    Island: cardSchema,
    Swamp: cardSchema,
    Mountain: cardSchema,
    Forest: cardSchema,
  },
  unopenedPacks: [[[Number]]],
});

module.exports = mongoose.model('Draft', draftSchema);
