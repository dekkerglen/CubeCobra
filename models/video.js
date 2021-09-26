const mongoose = require('mongoose');

const videoSchema = mongoose.Schema({
  title: String,
  body: String,
  short: String,
  url: String,
  owner: mongoose.Schema.Types.ObjectId,
  date: Date,
  image: String,
  imagename: String,
  artist: String,
  status: {
    type: String,
    enum: ['draft', 'inReview', 'published'],
  },
  username: {
    type: String,
    default: 'User',
  },
});

videoSchema.index({
  owner: 1,
  date: -1,
});

videoSchema.index({
  date: -1,
});

videoSchema.index({
  status: 1,
  date: -1,
});

module.exports = mongoose.model('Video', videoSchema);
