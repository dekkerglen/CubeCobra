const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

// data for each seat, human or bot
const Seat = {
  bot: Boolean,
  name: String,
  userid: String,
  drafted: [[cardSchema]], // organized draft picks
  sideboard: [[cardSchema]], // organized draft picks
  pickorder: [cardSchema],
};

// Cube schema
const gridDraftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[cardSchema]],
  seats: [Seat],
  unopenedPacks: [[cardSchema]],
  synergies: [[Number]],
  basics: {
    Plains: cardSchema,
    Island: cardSchema,
    Swamp: cardSchema,
    Mountain: cardSchema,
    Forest: cardSchema,
  },
});

module.exports = mongoose.model('GridDraft', gridDraftSchema);
