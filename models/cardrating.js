let mongoose = require('mongoose');

// Cube schema
let cardRatingSchema = mongoose.Schema(
  {
    value:Number,
    picks:Number
  }
);

let CardRating = module.exports = mongoose.model('CardRating',cardRatingSchema)
