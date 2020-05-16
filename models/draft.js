const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

// Details on each pack, how to draft and what's in it.
const Pack = {
  cards: [
    {
      type: Number,
      min: 0,
    },
  ],
  sealed: {
    type: Boolean,
    default: false,
  },
  trash: {
    type: Number,
    default: 0,
  },
};

// data for each seat, human or bot
const Seat = {
  bot: [String], // null bot value means human player
  name: String,
  userid: String,
  drafted: [[Number]], // organized draft picks
  sideboard: [[Number]], // organized draft picks
  pickorder: [Number],
  packbacklog: [Pack],
};

// Cube schema
const draftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[[Number]]],
  seats: [Seat],
  cards: [cardSchema],
  basics: {
    Plains: cardSchema,
    Island: cardSchema,
    Swamp: cardSchema,
    Mountain: cardSchema,
    Forest: cardSchema,
    Wastes: cardSchema,
  },
  unopenedPacks: [[Pack]],
});

module.exports = mongoose.model('Draft', draftSchema);
