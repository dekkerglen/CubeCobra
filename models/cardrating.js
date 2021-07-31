const mongoose = require('mongoose');

const cardRatingSchema = mongoose.Schema({
  value: Number,
  elo: Number,
  picks: Number,
  name: String,
  embedding: [Number],
});

cardRatingSchema.index({
  name: 1,
});

cardRatingSchema.index({
  elo: -1,
});

module.exports = mongoose.model('CardRating', cardRatingSchema);
