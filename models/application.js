const mongoose = require('mongoose');

// Deck schema
const applicationSchema = mongoose.Schema({
  userid: String,
  info: String,
  timePosted: Date,
});

module.exports = mongoose.model('Application', applicationSchema);
