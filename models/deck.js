let mongoose = require('mongoose');

//this pattern lets us define comment recursively
var Comment = new mongoose.Schema();
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

// Cube schema
let deckSchema = mongoose.Schema({
  cards: [[]],
  owner: String,
  cube: {
    type: String,
    index: true,
  },
  date: {
    type: Date,
    index: true,
  },
  name: String,
  bots: [[]],
  playerdeck: [[]],
  playersideboard: [[]],
  cols: Number,
  username: {
    type: String,
    default: 'User',
  },
  cubename: {
    type: String,
    default: 'Cube',
  },
  draft: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: 'No description available.',
  },
  newformat: {
    type: Boolean,
    default: false,
  },
  comments: {
    type: [Comment],
    default: [],
  },
});

let Deck = (module.exports = mongoose.model('Deck', deckSchema));
