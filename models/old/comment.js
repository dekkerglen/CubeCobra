const mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
  parent: String, // either a Mongo ObjectId or a card's Scryfall ID
  parentType: {
    type: String,
    enum: ['comment', 'blog', 'deck', 'card', 'article', 'podcast', 'video', 'episode', 'package'],
  },
  owner: mongoose.Schema.Types.ObjectId,
  ownerName: String,
  content: String,
  timePosted: Date,
  updated: Boolean,
  image: {
    type: String,
    default:
      'https://c1.scryfall.com/file/scryfall-cards/art_crop/front/0/c/0c082aa8-bf7f-47f2-baf8-43ad253fd7d7.jpg?1562826021',
  },
  artist: {
    type: String,
    default: 'Allan Pollack',
  },
  date: Date,
});

commentSchema.index({
  parent: 1,
  date: 1,
});

commentSchema.index({
  timePosted: -1,
});

module.exports = mongoose.model('Comment', commentSchema);
