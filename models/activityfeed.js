let mongoose = require('mongoose');

let activityFeedSchema = mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity'
  }
});

let ActivityFeed = module.exports = mongoose.model('NewsFeed', activityFeedSchema)