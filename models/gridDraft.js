const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

// data for each seat, human or bot
const Seat = {
  bot: Boolean,
  name: String,
  userid: String,
  drafted: [[Number]], // organized draft picks
  sideboard: [[Number]], // organized draft picks
  pickorder: [[Number]],
};

// Cube schema
const gridDraftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[Number]],
  seats: [Seat],
  unopenedPacks: [[Number]],
  draftType: {
    type: String,
    enum: ['bot', '2playerlocal'],
  },
  cards: [cardSchema],
  basics: {
    Plains: cardSchema,
    Island: cardSchema,
    Swamp: cardSchema,
    Mountain: cardSchema,
    Forest: cardSchema,
    Wastes: cardSchema,
  },
});

module.exports = mongoose.model('GridDraft', gridDraftSchema);
