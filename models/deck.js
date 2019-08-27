let mongoose = require('mongoose');

// Cube schema
let deckSchema = mongoose.Schema({
  cards: [
    []
  ],
  owner: String,
  cube: String,
  date: Date,
  name: String,
  bots: [
    []
  ],
  playerdeck: [
    []
  ],
  playersideboard: [
    []
  ],
  cols: Number
});

let Deck = module.exports = mongoose.model('Deck', deckSchema)