let mongoose = require('mongoose');

let activitySchema = mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  timestamp: {
    type: Date,
    required: true
  },
  referenceId: {
    type: String,
    required: true
  }
});

let Activity = module.exports = mongoose.model('Activity', activitySchema)