const mongoose = require('mongoose');

// Deck schema
const reportSchema = mongoose.Schema({
  commentid: String,
  info: String,
  reason: String,
  reportee: String,
  timePosted: Date,
});

reportSchema.index({
  reason: 1,
  timePosted: -1,
});

module.exports = mongoose.model('Report', reportSchema);
