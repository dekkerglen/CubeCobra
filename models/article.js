const mongoose = require('mongoose');

// Blog schema
const articleSchema = mongoose.Schema({
  title: String,
  body: String,
  short: String,
  owner: String,
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

articleSchema.index({
  owner: 1,
  date: -1,
});

articleSchema.index({
  date: -1,
});

articleSchema.index({
  status: 1,
  date: -1,
});

module.exports = mongoose.model('Article', articleSchema);
