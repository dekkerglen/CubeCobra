const mongoose = require('mongoose');

const cardSchema = require('./shared/cardSchema');
const stepsSchema = require('./shared/stepsSchema');

// Details on each pack, how to draft and what's in it.
const Pack = {
  cards: {
    type: [
      {
        type: Number,
        min: 0,
      },
    ],
    default() {
      if (this.isNew) {
        return [];
      }
      return void 0; // eslint-disable-line
    },
  },
  steps: {
    type: stepsSchema,
    default() {
      if (this.isNew) {
        return null;
      }
      return void 0; // eslint-disable-line
    },
  },
};

// data for each seat, human or bot
const Seat = {
  bot: Boolean, // null bot value means human player
  name: String,
  userid: mongoose.Schema.Types.ObjectId,
  drafted: [[[Number]]], // organized draft picks
  sideboard: [[[Number]]], // organized draft picks
  pickorder: [Number], // cards this player picked in order of when they were picked
  trashorder: [Number], // cards this player trashed in order of when they were trashed
};

const draftSchema = mongoose.Schema(
  {
    basics: {
      default: [],
      type: [Number],
    },
    cards: [cardSchema],
    cube: mongoose.Schema.Types.ObjectId,
    initial_state: [[Pack]],
    schemaVersion: {
      type: Number,
      default() {
        return void 0; // eslint-disable-line
      },
    },
    seats: [Seat],
    seed: String,
  },
  { timestamps: true },
);

draftSchema.index({
  schemaVersion: 1,
});

const Draft = mongoose.model('Draft', draftSchema);
Draft.CURRENT_SCHEMA_VERSION = 1;

module.exports = Draft;
