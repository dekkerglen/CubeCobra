let mongoose = require('mongoose');

// card schema for analytics only. Use card objects for most use cases
let cardSchema = mongoose.Schema({
  cardName: {
    type: String,
    index: true,
  },
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
  cubedWith: [[String]], //this is list of card ids
  cubes: [String], //this is a list of cube ids
  cubesLength: { // length of cubes for indexing purposes
    type: Number,
    index: true,
  },
});

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;
