const mongoose = require('mongoose');

const Datapoint = {
  elo: Number,
  rating: Number,
  picks: Number,
  cubes: Number,
  prices: [
    {
      version: String,
      price: Number,
      price_foil: Number,
    },
  ],
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
    // Normal card name, not lowercased.
    type: String,
    index: true,
  },
  oracleId: {
    type: String,
    index: true,
  },
  versions: {
    type: [String], // Card IDs for all versions of this card.
    index: true,
  },
  current: Datapoint,
  cubedWith: [String], // this is list of card ids
  cubes: [String], // this is a list of cube ids
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

cardHistorySchema.index({ 'current.rating': 1 });
cardHistorySchema.index({ 'current.elo': -1 });
cardHistorySchema.index({ 'current.picks': -1 });
cardHistorySchema.index({ 'current.cubes': -1 });

const CardHistory = mongoose.model('CardHistory', cardHistorySchema);

module.exports = CardHistory;
