const mongoose = require('mongoose');

const podcastSchema = mongoose.Schema({
  title: String,
  description: String,
  url: String,
  rss: String,
  owner: mongoose.Schema.Types.ObjectId,
  image: String,
  date: Date,
  username: {
    type: String,
    default: 'User',
  },
  status: {
    type: String,
    enum: ['draft', 'inReview', 'published'],
  },
});

podcastSchema.index({
  owner: 1,
});

module.exports = mongoose.model('Podcast', podcastSchema);
