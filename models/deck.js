const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

// this pattern lets us define comment recursively
const Comment = new mongoose.Schema();
Comment.add({
  owner: String,
  ownerName: String,
  content: String,
  index: Number,
  timePosted: Date,
  comments: [Comment],
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

// data for each seat, human or bot
const SeatDeck = {
  bot: [String], // null bot value means human player
  userid: String,
  username: String,
  pickorder: [cardSchema],
  name: String,
  description: {
    type: String,
    default: 'No description available.',
  },
  cols: Number,
  deck: [[cardSchema]],
  sideboard: [[cardSchema]],
};

// Deck schema
const deckSchema = mongoose.Schema({
  cube: String,
  cubeOwner: String,
  owner: String,
  date: Date,
  comments: {
    type: [Comment],
    default: [],
  },
  draft: {
    type: String,
    default: '',
  },
  cubename: {
    type: String,
    default: 'Cube',
  },
  seats: {
    type: [SeatDeck],
    default: [],
  },
});

deckSchema.index({
  cubeOwner: 1,
  date: -1,
});

deckSchema.index({
  date: -1,
});

deckSchema.index({
  cube: 1,
  date: -1,
});

deckSchema.index({
  owner: 1,
  date: -1,
});

module.exports = mongoose.model('Deck', deckSchema);
