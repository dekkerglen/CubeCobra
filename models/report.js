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
  timePosted: -1,
});

reportSchema.index({
  commentid: 1,
});

module.exports = mongoose.model('Report', reportSchema);
