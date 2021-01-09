const mongoose = require('mongoose');
const { withMigrations } = require('@baethon/mongoose-lazy-migration');

const cardSchema = require('./cardSchema');
const gridDraftMigrations = require('./migrations/gridDraftMigrations');

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
  basics: {
    Plains: cardSchema,
    Island: cardSchema,
    Swamp: cardSchema,
    Mountain: cardSchema,
    Forest: cardSchema,
    Wastes: cardSchema,
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
});

module.exports = mongoose.model('GridDraft', withMigrations(gridDraftSchema, gridDraftMigrations));
