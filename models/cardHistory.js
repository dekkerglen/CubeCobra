const mongoose = require('mongoose');

const Datapoint = {
  elo: Number,
  price: Number,
  price_foil: Number,
  size180: [Number],
  size360: [Number],
  size450: [Number],
  size540: [Number],
  size720: [Number],
  pauper: [Number],
  legacy: [Number],
  modern: [Number],
  standard: [Number],
  vintage: [Number],
  total: [Number],
};

// card schema for analytics only. Use card objects for most use cases
const cardHistorySchema = mongoose.Schema({
  cardName: {
    type: String,
    index: true,
  },
  cardID: {
    type: String,
    index: true,
  },
  current: Datapoint,
  cubedWith: [[String]], // this is list of card ids
  cubes: [String], // this is a list of cube ids
  cubesLength: {
    // length of current cubes for indexing purposes
    type: Number,
    index: true,
  },
  history: {
    type: [
      {
        date: String,
        data: Datapoint,
      },
    ],
    default: [],
  },
});

const CardHistory = mongoose.model('CardHistory', cardHistorySchema);

module.exports = CardHistory;
