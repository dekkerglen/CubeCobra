const mongoose = require('mongoose');

const cardSchema = require('./shared/cardSchema');
const CURRENT_SCHEMA_VERSION = require('./migrations/deckMigrations').slice(-1)[0].version;

// data for each seat, human or bot
const Seat = {
  bot: Boolean,
  name: String,
  userid: String,
  drafted: [[[Number]]], // organized draft picks
  sideboard: [[[Number]]], // organized draft picks
  pickorder: [Number],
  pickedIndices: [Number],
};

// Cube schema
const gridDraftSchema = mongoose.Schema({
  basics: {
    default: [],
    type: [Number],
  },
  cards: [cardSchema],
  cube: String,
  draftType: {
    type: String,
    enum: ['bot', '2playerlocal'],
  },
  initial_state: [[Number]],
  seats: [Seat],
  unopenedPacks: [[Number]],
  schemaVersion: {
    type: Number,
    default() {
      if (this.isNew) {
        return CURRENT_SCHEMA_VERSION;
      }
      return void 0; // eslint-disable-line
    },
  },
});

gridDraftSchema.index({
  schemaVersion: 1,
});

gridDraftSchema.pre('save', () => {
  this.schemaVersion = CURRENT_SCHEMA_VERSION;
});
const GridDraft = mongoose.model('GridDraft', gridDraftSchema);
GridDraft.CURRENT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

module.exports = GridDraft;
