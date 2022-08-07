const mongoose = require('mongoose');

const cardSchema = require('../shared/cardSchema');

// data for each seat, human or bot
const Seat = {
  bot: Boolean,
  name: String,
  userid: mongoose.Schema.Types.ObjectId,
  drafted: [[[Number]]], // organized draft picks
  sideboard: [[[Number]]], // organized draft picks
  pickorder: [Number],
  pickedIndices: [Number],
};

const gridDraftSchema = mongoose.Schema({
  basics: {
    default: [],
    type: [Number],
  },
  cards: [cardSchema],
  cube: mongoose.Schema.Types.ObjectId,
  draftType: {
    type: String,
    enum: ['bot', '2playerlocal'],
  },
  initial_state: [[Number]],
  seats: [Seat],
  schemaVersion: {
    type: Number,
    default() {
      return void 0; // eslint-disable-line
    },
  },
});

gridDraftSchema.index({
  schemaVersion: 1,
});

const GridDraft = mongoose.model('GridDraft', gridDraftSchema);

module.exports = GridDraft;
