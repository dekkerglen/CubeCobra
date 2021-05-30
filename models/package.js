const mongoose = require('mongoose');

// Blog schema
const packageSchema = mongoose.Schema({
  title: String,
  date: Date,
  userid: String,
  username: String,
  approved: {
    type: Boolean,
    required: true,
    default: false,
  },
  cards: {
    type: [String],
    default: [],
  },
  votes: {
    type: Number,
    default: 0,
  },
  voters: {
    type: [String],
    default: [],
  },
  keywords: {
    type: [String],
    default: [],
  },
});

packageSchema.index({
  votes: 1,
  date: -1,
});

packageSchema.index({
  approved: 1,
  date: -1,
});

packageSchema.index({
  keywords: 1,
  date: -1,
});

module.exports = mongoose.model('Package', packageSchema);
