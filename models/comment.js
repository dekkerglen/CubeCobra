const mongoose = require('mongoose');

// Deck schema
const commentSchema = mongoose.Schema({
  parent: String,
  parentType: {
    type: String,
    enum: ['comment', 'blog', 'deck', 'card'],
  },
  owner: String,
  ownerName: String,
  content: String,
  timePosted: Date,
  updated: Boolean,
  image: {
    type: String,
    default: 'https://img.scryfall.com/cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021',
  },
  artist: {
    type: String,
    default: 'Allan Pollack',
  },
});

commentSchema.index({
  parent: 1,
  timePosted: 1,
});

module.exports = mongoose.model('Comment', commentSchema);
