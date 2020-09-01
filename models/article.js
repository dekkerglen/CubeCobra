const mongoose = require('mongoose');

// Blog schema
const articleSchema = mongoose.Schema({
  title: String,
  body: String,
  owner: String,
  date: Date,
  changelist: String,
  username: {
    type: String,
    default: 'User',
  },
});

module.exports = mongoose.model('Article', articleSchema);
