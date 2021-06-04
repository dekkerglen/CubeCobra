const mongoose = require('mongoose');

const cardSchema = require('./shared/cardSchema');
const stepsSchema = require('./shared/stepsSchema');
const CURRENT_SCHEMA_VERSION = require('./migrations/draftMigrations').slice(-1)[0].version;

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

// // data for each seat, human or bot
const Seat = {
  bot: Boolean, // null bot value means human player
  name: String,
  userid: String,
  drafted: [[[Number]]], // organized draft picks
  sideboard: [[[Number]]], // organized draft picks
  pickorder: [Number], // cards this player picked in order of when they were picked
  trashorder: [Number], // cards this player trashed in order of when they were trashed
};

// Cube schema
const draftSchema = mongoose.Schema(
  {
    basics: {
      default: [],
      type: [Number],
    },
    cards: [cardSchema],
    cube: String,
    initial_state: [[Pack]],
    schemaVersion: {
      type: Number,
      default() {
        if (this.isNew) {
          return CURRENT_SCHEMA_VERSION;
        }
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

draftSchema.pre('save', () => {
  this.schemaVersion = CURRENT_SCHEMA_VERSION;
});
const Draft = mongoose.model('Draft', draftSchema);
Draft.CURRENT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

module.exports = Draft;
