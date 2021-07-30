const mongoose = require('mongoose');

// Blog schema
const podcastEpisodeSchema = mongoose.Schema({
  title: String,
  podcastname: String,
  description: String,
  podcast: mongoose.Schema.Types.ObjectId,
  source: String,
  owner: mongoose.Schema.Types.ObjectId,
  image: String,
  date: Date,
  guid: String,
  link: String,
  username: {
    type: String,
    default: 'User',
  },
});

podcastEpisodeSchema.index({
  owner: 1,
});

module.exports = mongoose.model('PodcastEpisode', podcastEpisodeSchema);
