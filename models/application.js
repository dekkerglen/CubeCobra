const mongoose = require('mongoose');

// Deck schema
const applicationSchema = mongoose.Schema({
  userid: mongoose.Schema.Types.ObjectId,
  info: String,
  timePosted: Date,
});

module.exports = mongoose.model('Application', applicationSchema);
