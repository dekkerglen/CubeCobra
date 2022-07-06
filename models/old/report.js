const mongoose = require('mongoose');

const reportSchema = mongoose.Schema({
  commentid: mongoose.Schema.Types.ObjectId,
  info: String,
  reason: String,
  reportee: mongoose.Schema.Types.ObjectId,
  timePosted: Date,
});

reportSchema.index({
  timePosted: -1,
});

reportSchema.index({
  commentid: 1,
});

module.exports = mongoose.model('Report', reportSchema);
