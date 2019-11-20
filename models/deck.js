let mongoose = require('mongoose');

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
});

let Deck = (module.exports = mongoose.model('Deck', deckSchema));
