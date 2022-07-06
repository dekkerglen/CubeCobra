const mongoose = require('mongoose');

const applicationSchema = mongoose.Schema({
  userid: mongoose.Schema.Types.ObjectId,
  info: String,
  timePosted: Date,
});

module.exports = mongoose.model('Application', applicationSchema);
