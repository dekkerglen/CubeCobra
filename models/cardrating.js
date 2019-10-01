let mongoose = require('mongoose');

// Cube schema
let cardRatingSchema = mongoose.Schema({
  value: Number,
  picks: Number,
  name: String
});

cardRatingSchema.index({
  name: 1,
});

let CardRating = module.exports = mongoose.model('CardRating', cardRatingSchema)