const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

// data for each seat, human or bot
const Seat = {
  bot: Boolean,
  name: String,
  userid: String,
  drafted: [[cardSchema]], // organized draft picks
  sideboard: [[cardSchema]], // organized draft picks
  pickorder: [[cardSchema]],
};

// Cube schema
const gridDraftSchema = mongoose.Schema({
  cube: String,
  initial_state: [[cardSchema]],
  seats: [Seat],
  unopenedPacks: [[cardSchema]],
  draftType: {
    type: String,
    enum: ['bot', '2playerlocal'],
  },
  basics: {
    default: [],
    type: {
      details: cardSchema,
      cardID: String,
      cmc: Number,
      type_line: String,
    },
  },
});

module.exports = mongoose.model('GridDraft', gridDraftSchema);
